function initializeApp() {
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDK не загружен. Проверьте подключение скриптов.');
    return;
  }
  console.log('Firebase загружен успешно.');

  const firebaseConfig = {
    apiKey: "AIzaSyB3PAQQTpeTxlaeT7cIXqqspGDOcAkBQog",
    authDomain: "evabar-ac842.firebaseapp.com",
    databaseURL: "https://evabar-ac842-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "evabar-ac842",
    storageBucket: "evabar-ac842.firebasestorage.app",
    messagingSenderId: "938549088383",
    appId: "1:938549088383:web:9a6d241040520ccfef6f4a"
  };

  try {
    firebase.initializeApp(firebaseConfig);
    console.log('Firebase инициализирован.');
  } catch (error) {
    console.error('Ошибка инициализации Firebase:', error);
    return;
  }

  const auth = firebase.auth();
  const db = firebase.firestore();
  const SALARY_RATE = 0.4;
  let currentCategoryFilter = null;

  async function loadNav() {
    const navElement = document.getElementById('nav');
    if (!navElement) {
      console.warn('Элемент с id="nav" не найден. Загрузка nav.html пропущена.');
      return;
    }
    try {
      const response = await fetch('/bar/nav.html');
      if (!response.ok) throw new Error('Не удалось загрузить nav.html');
      navElement.innerHTML = await response.text();
    } catch (error) {
      console.error('Ошибка загрузки nav.html:', error);
    }
  }

  async function login() {
    const email = document.getElementById('email')?.value;
    const password = document.getElementById('password')?.value;
    if (!email || !password) {
      alert('Ошибка входа: Введите email и пароль.');
      return;
    }
    try {
      await auth.signInWithEmailAndPassword(email, password);
      window.location.href = '/bar/menu.html';
    } catch (error) {
      console.error('Ошибка входа:', error);
      alert('Ошибка входа: Неверный email или пароль.');
    }
  }

  async function logout() {
    try {
      await auth.signOut();
      window.location.href = '/bar/index.html';
    } catch (error) {
      console.error('Ошибка выхода:', error);
      alert('Ошибка выхода: ' + error.message);
    }
  }

  async function calculateDishMetrics(ingredients) {
    let price_current_dish = 0;
    if (!ingredients || ingredients.length === 0) {
      console.warn('Массив ingredients пустой или отсутствует');
      return { price_current_dish: 0 };
    }
    for (const ing of ingredients) {
      if (!ing.ingredient_id || !ing.quantity) {
        console.warn(`Некорректный ингредиент: ${JSON.stringify(ing)}`);
        continue;
      }
      const ingredient = await db.collection('ingredients').doc(ing.ingredient_id).get();
      if (ingredient.exists) {
        const ingData = ingredient.data();
        price_current_dish += ing.quantity * (ingData.current_price_product || 0);
      } else {
        console.warn(`Ингредиент ${ing.ingredient_id} не найден`);
      }
    }
    return { price_current_dish };
  }

  async function loadMenu() {
    const categoriesDiv = document.getElementById('categories');
    if (!categoriesDiv) return;
    try {
      const categories = await db.collection('categories').where('isVisible', '==', true).orderBy('number', 'asc').get();
      const dishes = await db.collection('dishes').where('is_active_dish', '==', true).get();
      categoriesDiv.innerHTML = '';
      if (categories.empty) {
        categoriesDiv.innerHTML = '<p>Категории отсутствуют</p>';
        return;
      }
      categories.forEach(cat => {
        const catDiv = document.createElement('div');
        catDiv.innerHTML = `<h2 class="text-xl">${cat.data().name}</h2>`;
        dishes.forEach(dish => {
          if (dish.data().category_id === cat.id) {
            const dishData = dish.data();
            catDiv.innerHTML += `
              <div class="border p-2 flex items-center">
                ${dishData.image_dish ? `<img src="${dishData.image_dish}" alt="${dishData.name_dish}" class="w-16 h-16 object-cover mr-4">` : ''}
                <div>
                  <p class="font-bold">${dishData.name_dish} - ${dishData.price_dish} $</p>
                  <p>${dishData.description_dish || 'Нет описания'}</p>
                  <p>Вес: ${dishData.weight_dish != null ? dishData.weight_dish : 0} г</p>
                  <p>Мин. порций: ${dishData.min_dish || 0}</p>
                  <button onclick="addToOrder('${dish.id}', '${dishData.name_dish}', ${dishData.price_dish})" class="bg-blue-600 text-white p-1 rounded mt-2">Добавить</button>
                </div>
              </div>`;
          }
        });
        categoriesDiv.appendChild(catDiv);
      });
    } catch (error) {
      console.error('Ошибка загрузки меню:', error);
      alert('Ошибка при загрузке меню: ' + error.message);
    }
  }

  let orderItems = [];
  function addToOrder(dishId, name, price) {
    orderItems.push({ dishId, name, price });
    renderOrder();
  }

  function renderOrder() {
    const orderList = document.getElementById('order-items');
    if (!orderList) return;
    orderList.innerHTML = '';
    if (orderItems.length === 0) {
      orderList.innerHTML = '<li>Заказ пуст</li>';
      return;
    }
    orderItems.forEach(item => {
      orderList.innerHTML += `<li>${item.name} - ${item.price} $</li>`;
    });
  }

  async function placeOrder() {
    const comment = document.getElementById('order-comment')?.value || '';
    try {
      await db.collection('orders').add({
        items: orderItems,
        comment,
        user: auth.currentUser?.uid || 'anonymous',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      for (const item of orderItems) {
        const dish = await db.collection('dishes').doc(item.dishId).get();
        const ingredients = dish.data()?.ingredients || [];
        for (const ing of ingredients) {
          const ingredientRef = db.collection('ingredients').doc(ing.ingredient_id);
          const ingredient = await ingredientRef.get();
          if (ingredient.exists) {
            await ingredientRef.update({
              stock_quantity_product: (ingredient.data().stock_quantity_product || 0) - ing.quantity
            });
          }
        }
      }
      orderItems = [];
      renderOrder();
      alert('Заказ оформлен!');
      if (document.getElementById('order-ingredients-list')) {
        await loadOrderIngredients();
      }
    } catch (error) {
      console.error('Ошибка оформления заказа:', error);
      alert('Ошибка при оформлении заказа: ' + error.message);
    }
  }

  async function addPromocode() {
    const code = document.getElementById('promo-code')?.value;
    const discount = parseInt(document.getElementById('promo-discount')?.value) || 0;
    if (!code || !discount) {
      alert('Пожалуйста, заполните код и скидку.');
      return;
    }
    try {
      await db.collection('promocodes').add({ code, discount });
      await loadPromocodes();
      alert('Промокод добавлен!');
    } catch (error) {
      console.error('Ошибка добавления промокода:', error);
      alert('Ошибка при добавлении промокода: ' + error.message);
    }
  }

  async function loadPromocodes() {
    const list = document.getElementById('promocodes-list');
    if (!list) return;
    try {
      const promocodes = await db.collection('promocodes').get();
      list.innerHTML = '';
      if (promocodes.empty) {
        list.innerHTML = '<li>Промокоды отсутствуют</li>';
        return;
      }
      promocodes.forEach(promo => {
        list.innerHTML += `<li>${promo.data().code} - ${promo.data().discount}%</li>`;
      });
    } catch (error) {
      console.error('Ошибка загрузки промокодов:', error);
    }
  }

  async function addDish() {
    const name_dish = document.getElementById('dish-name')?.value;
    const description_dish = document.getElementById('dish-description')?.value || '';
    const price_dish = parseFloat(document.getElementById('dish-price')?.value) || 0;
    const category_id = document.getElementById('dish-category')?.value;
    const image_dish = document.getElementById('dish-image')?.value || '';
    const is_active_dish = document.getElementById('dish-active')?.checked || false;
    const weight_dish = document.getElementById('dish-weight')?.value ? parseFloat(document.getElementById('dish-weight').value) : null;
    const min_dish = parseInt(document.getElementById('dish-min-portions')?.value) || 0;
    const ingredientRows = document.querySelectorAll('.ingredient-row');
    const ingredients = Array.from(ingredientRows).map(row => ({
      ingredient_id: row.querySelector('#ingredient-search').value,
      quantity: parseFloat(row.querySelector('.dish-ingredient-quantity').value) || 0
    })).filter(ing => ing.ingredient_id && ing.quantity > 0);

    if (!name_dish || !price_dish || !category_id || !min_dish || ingredients.length === 0) {
      alert('Пожалуйста, заполните все обязательные поля и добавьте хотя бы один ингредиент.');
      return;
    }

    try {
      const category = await db.collection('categories').doc(category_id).get();
      if (!category.exists) {
        alert('Выбранная категория не существует.');
        return;
      }

      const { price_current_dish } = await calculateDishMetrics(ingredients);
      if (price_current_dish === 0) {
        alert('Ошибка: Не удалось рассчитать себестоимость.');
        return;
      }
      const salary_dish = Math.floor((price_dish - price_current_dish) * SALARY_RATE * 10) / 10;
      const price_profit_dish = Math.floor((price_dish - price_current_dish - salary_dish) * 10) / 10;

      const dishRef = await db.collection('dishes').add({
        dish_id: '',
        category_id,
        name_dish,
        description_dish,
        price_dish,
        price_current_dish,
        salary_dish,
        price_profit_dish,
        image_dish,
        is_active_dish,
        min_dish,
        weight_dish,
        ingredients
      });

      await db.collection('dishes').doc(dishRef.id).update({ dish_id: dishRef.id });
      await loadDishes();
      cancelDishForm();
      if (document.getElementById('order-ingredients-list')) {
        await loadOrderIngredients();
      }
      alert('Блюдо успешно добавлено!');
    } catch (error) {
      console.error('Ошибка добавления блюда:', error);
      alert('Ошибка при добавлении блюда: ' + error.message);
    }
  }

  async function editDish(dishId) {
    const name_dish = document.getElementById('dish-name')?.value;
    const description_dish = document.getElementById('dish-description')?.value || '';
    const price_dish = parseFloat(document.getElementById('dish-price')?.value) || 0;
    const category_id = document.getElementById('dish-category')?.value;
    const image_dish = document.getElementById('dish-image')?.value || '';
    const is_active_dish = document.getElementById('dish-active')?.checked || false;
    const weight_dish = document.getElementById('dish-weight')?.value ? parseFloat(document.getElementById('dish-weight').value) : null;
    const min_dish = parseInt(document.getElementById('dish-min-portions')?.value) || 0;
    const ingredientRows = document.querySelectorAll('.ingredient-row');
    const ingredients = Array.from(ingredientRows).map(row => ({
      ingredient_id: row.querySelector('#ingredient-search').value,
      quantity: parseFloat(row.querySelector('.dish-ingredient-quantity').value) || 0
    })).filter(ing => ing.ingredient_id && ing.quantity > 0);

    if (!name_dish || !price_dish || !category_id || !min_dish || ingredients.length === 0) {
      alert('Пожалуйста, заполните все обязательные поля и добавьте хотя бы один ингредиент.');
      return;
    }

    try {
      const category = await db.collection('categories').doc(category_id).get();
      if (!category.exists) {
        alert('Выбранная категория не существует.');
        return;
      }

      const { price_current_dish } = await calculateDishMetrics(ingredients);
      if (price_current_dish === 0) {
        alert('Ошибка: Не удалось рассчитать себестоимость.');
        return;
      }
      const salary_dish = Math.floor((price_dish - price_current_dish) * SALARY_RATE * 10) / 10;
      const price_profit_dish = Math.floor((price_dish - price_current_dish - salary_dish) * 10) / 10;

      await db.collection('dishes').doc(dishId).update({
        category_id,
        name_dish,
        description_dish,
        price_dish,
        price_current_dish,
        salary_dish,
        price_profit_dish,
        image_dish,
        is_active_dish,
        min_dish,
        weight_dish,
        ingredients
      });

      await loadDishes();
      cancelDishForm();
      if (document.getElementById('order-ingredients-list')) {
        await loadOrderIngredients();
      }
      alert('Блюдо успешно обновлено!');
    } catch (error) {
      console.error('Ошибка обновления блюда:', error);
      alert('Ошибка при обновлении блюда: ' + error.message);
    }
  }

  async function loadDishForEdit(dishId) {
    try {
      const dish = await db.collection('dishes').doc(dishId).get();
      if (!dish.exists) {
        alert('Блюдо не найдено');
        return;
      }
      const dishData = dish.data();

      await loadCategories();

      document.getElementById('dish-name').value = dishData.name_dish || '';
      document.getElementById('dish-description').value = dishData.description_dish || '';
      document.getElementById('dish-price').value = dishData.price_dish || 0;
      document.getElementById('dish-category').value = dishData.category_id || '';
      document.getElementById('dish-image').value = dishData.image_dish || '';
      document.getElementById('dish-image-preview').src = dishData.image_dish || '';
      document.getElementById('dish-image-preview').style.display = dishData.image_dish ? 'block' : 'none';
      document.getElementById('dish-active').checked = dishData.is_active_dish || false;
      document.getElementById('dish-weight').value = dishData.weight_dish != null ? dishData.weight_dish : '';
      document.getElementById('dish-min-portions').value = dishData.min_dish || 0;

      const container = document.getElementById('ingredients-container');
      container.innerHTML = `
        <div class="ingredient-row mb-2 flex items-center">
          <input type="text" id="ingredient-search" class="border p-2 mr-2 w-2/3 rounded" placeholder="Введите название ингредиента" list="ingredient-options">
          <datalist id="ingredient-options"></datalist>
          <input type="number" class="dish-ingredient-quantity border p-2 w-1/3 rounded" placeholder="Количество" min="0" step="0.1">
        </div>
      `;
      dishData.ingredients?.forEach((ing, index) => {
        if (index > 0) {
          const row = document.createElement('div');
          row.className = 'ingredient-row mb-2 flex items-center';
          row.innerHTML = `
            <input type="text" id="ingredient-search" class="border p-2 mr-2 w-2/3 rounded" placeholder="Введите название ингредиента" list="ingredient-options">
            <datalist id="ingredient-options"></datalist>
            <input type="number" class="dish-ingredient-quantity border p-2 w-1/3 rounded" placeholder="Количество" min="0" step="0.1">
            <button onclick="this.parentElement.remove();" class="bg-red-600 text-white p-1 rounded ml-2">Удалить</button>
          `;
          container.appendChild(row);
        }
        const row = container.querySelectorAll('.ingredient-row')[index];
        row.querySelector('.dish-ingredient-quantity').value = ing.quantity || 0;
      });

      await loadIngredientsSelect();
      dishData.ingredients?.forEach((ing, index) => {
        const row = container.querySelectorAll('.ingredient-row')[index];
        row.querySelector('#ingredient-search').value = ing.ingredient_id || '';
      });

      document.getElementById('dish-form').dataset.dishId = dishId;
      document.getElementById('dish-form-button').textContent = 'Сохранить изменения';
      document.getElementById('dish-form').classList.remove('hidden');
    } catch (error) {
      console.error('Ошибка загрузки блюда для редактирования:', error);
      alert('Ошибка при загрузке блюда: ' + error.message);
    }
  }

  async function addCategory() {
    const name = document.getElementById('category-name')?.value;
    const isVisible = document.getElementById('category-visible')?.checked || false;
    const number = parseInt(document.getElementById('category-number')?.value) || 0;
    const categoryId = document.getElementById('category-form')?.dataset.categoryId;

    if (!name) {
      alert('Пожалуйста, введите название категории.');
      return;
    }
    try {
      if (categoryId) {
        await db.collection('categories').doc(categoryId).update({ name, isVisible, number });
        alert('Категория успешно обновлена!');
      } else {
        await db.collection('categories').add({ name, isVisible, number });
        alert('Категория успешно добавлена!');
      }
      await loadCategories();
      await loadCategoryList();
      cancelCategoryForm();
    } catch (error) {
      console.error('Ошибка добавления/обновления категории:', error);
      alert('Ошибка при добавлении/обновлении категории: ' + error.message);
    }
  }

  async function loadCategories() {
    const select = document.getElementById('dish-category');
    const filterSelect = document.getElementById('filter-category');
    if (!select && !filterSelect) return;
    try {
      const categories = await db.collection('categories').orderBy('number', 'asc').get();
      if (select) {
        select.innerHTML = '<option value="">Выберите категорию</option>';
      }
      if (filterSelect) {
        filterSelect.innerHTML = '<option value="">Все категории</option>';
      }
      categories.forEach(cat => {
        if (select) {
          select.innerHTML += `<option value="${cat.id}">${cat.data().name}</option>`;
        }
        if (filterSelect) {
          filterSelect.innerHTML += `<option value="${cat.id}">${cat.data().name}</option>`;
        }
      });
    } catch (error) {
      console.error('Ошибка загрузки категорий:', error);
    }
  }

  async function loadCategoryList() {
    const list = document.getElementById('categories-list');
    if (!list) return;
    const showInactive = document.getElementById('show-inactive-categories')?.checked || false;
    try {
      const categoriesQuery = showInactive ? db.collection('categories') : db.collection('categories').where('isVisible', '==', true);
      const categories = await categoriesQuery.orderBy('number', 'asc').get();
      list.innerHTML = '<h2 class="text-xl font-bold mb-2">Список категорий</h2>';
      if (categories.empty) {
        list.innerHTML += '<li class="text-gray-500">Категории отсутствуют</li>';
        return;
      }
      categories.forEach(cat => {
        const catData = cat.data();
        list.innerHTML += `
          <li class="flex items-center justify-between p-2 border-b">
            <span class="cursor-pointer" onclick="toggleCategoryFilter('${cat.id}', '${catData.name}')">${catData.name} (Порядок: ${catData.number}, Видимость: ${catData.isVisible ? 'Вкл' : 'Выкл'})</span>
            <div class="flex gap-2">
              <button onclick="loadCategoryForEdit('${cat.id}')" class="bg-yellow-600 text-white p-1 rounded">Редактировать</button>
              <button onclick="deleteCategory('${cat.id}')" class="bg-red-600 text-white p-1 rounded">Удалить</button>
              <button onclick="toggleCategoryVisibility('${cat.id}', ${!catData.isVisible})" class="bg-blue-600 text-white p-1 rounded">
                ${catData.isVisible ? 'Скрыть' : 'Показать'}
              </button>
            </div>
          </li>`;
      });
    } catch (error) {
      console.error('Ошибка загрузки списка категорий:', error);
      if (error.code === 'failed-precondition' && error.message.includes('requires an index')) {
        alert('Для загрузки категорий требуется индекс в Firestore. Пожалуйста, создайте его в консоли Firebase или обратитесь к администратору.');
      } else {
        alert('Ошибка при загрузке категорий: ' + error.message);
      }
    }
  }

  async function toggleCategoryFilter(categoryId, categoryName) {
    if (currentCategoryFilter === categoryId) {
      currentCategoryFilter = null;
      if (document.getElementById('filter-category')) {
        document.getElementById('filter-category').value = '';
      }
    } else {
      currentCategoryFilter = categoryId;
      if (document.getElementById('filter-category')) {
        document.getElementById('filter-category').value = categoryId;
      }
    }
    await loadDishes();
  }

  async function loadCategoryForEdit(categoryId) {
    try {
      const category = await db.collection('categories').doc(categoryId).get();
      if (!category.exists) {
        alert('Категория не найдена');
        return;
      }
      const catData = category.data();

      document.getElementById('category-name').value = catData.name || '';
      document.getElementById('category-number').value = catData.number || 0;
      document.getElementById('category-visible').checked = catData.isVisible || false;
      document.getElementById('category-form').dataset.categoryId = categoryId;
      document.getElementById('category-form-button').textContent = 'Сохранить изменения';
      document.getElementById('category-form').classList.remove('hidden');
    } catch (error) {
      console.error('Ошибка загрузки категории для редактирования:', error);
      alert('Ошибка при загрузке категории: ' + error.message);
    }
  }

  async function deleteCategory(categoryId) {
    try {
      const dishes = await db.collection('dishes').where('category_id', '==', categoryId).get();
      if (!dishes.empty) {
        alert('Нельзя удалить категорию, так как в ней есть блюда.');
        return;
      }
      await db.collection('categories').doc(categoryId).delete();
      await loadCategories();
      await loadCategoryList();
      alert('Категория успешно удалена!');
    } catch (error) {
      console.error('Ошибка удаления категории:', error);
      alert('Ошибка при удалении категории: ' + error.message);
    }
  }

  async function toggleCategoryVisibility(categoryId, isVisible) {
    try {
      await db.collection('categories').doc(categoryId).update({ isVisible });
      await loadCategoryList();
      await loadDishes();
    } catch (error) {
      console.error('Ошибка изменения видимости категории:', error);
      alert('Ошибка при изменении видимости категории: ' + error.message);
    }
  }

  async function loadDishes() {
    const list = document.getElementById('dishes-list');
    if (!list) return;
    const filterCategory = currentCategoryFilter || document.getElementById('filter-category')?.value;
    try {
      const dishesQuery = filterCategory 
        ? db.collection('dishes').where('category_id', '==', filterCategory)
        : db.collection('dishes');
      const dishes = await dishesQuery.get();
      const categories = await db.collection('categories').get();
      const categoryMap = {};
      categories.forEach(cat => categoryMap[cat.id] = cat.data().name);
      list.innerHTML = '';
      if (dishes.empty) {
        list.innerHTML = '<p class="text-gray-500">Блюда отсутствуют</p>';
        return;
      }
      dishes.forEach(async (dish) => {
        const dishData = dish.data();
        const ingredients = dishData.ingredients || [];
        let ingredientNames = [];
        for (const ing of ingredients) {
          const ingredient = await db.collection('ingredients').doc(ing.ingredient_id).get();
          ingredientNames.push(ingredient.exists 
            ? `${ingredient.data().name_product} (${ing.quantity})`
            : `Неизвестный ингредиент (${ing.quantity})`);
        }
        const dishCard = document.createElement('div');
        dishCard.className = 'bg-white p-4 rounded shadow';
        dishCard.innerHTML = `
          <div class="flex flex-col h-full">
            ${dishData.image_dish ? `<img src="${dishData.image_dish}" alt="${dishData.name_dish}" class="w-[62px] h-[62px] object-cover rounded mb-2">` : '<div class="w-[62px] h-[62px] bg-gray-200 rounded mb-2"></div>'}
            <p class="font-bold">${dishData.name_dish} - ${dishData.price_dish} $</p>
            <p class="text-sm text-gray-600">Категория: ${categoryMap[dishData.category_id] || 'Нет'}</p>
            <button onclick="toggleDishDetails(this)" class="bg-gray-600 text-white p-1 rounded mt-2">Развернуть</button>
            <div class="dish-details hidden mt-2">
              <p class="text-sm text-gray-600">Себестоимость: ${Math.floor(dishData.price_current_dish * 10) / 10} $</p>
              <p class="text-sm text-gray-600">Зарплата: ${Math.floor(dishData.salary_dish * 10) / 10} $</p>
              <p class="text-sm text-gray-600">Прибыль: ${Math.floor(dishData.price_profit_dish * 10) / 10} $</p>
              <p class="text-sm text-gray-600">Описание: ${dishData.description_dish || 'Нет'}</p>
              <p class="text-sm text-gray-600">Вес: ${dishData.weight_dish != null ? dishData.weight_dish : 0} г</p>
              <p class="text-sm text-gray-600">Мин. порций: ${dishData.min_dish || 0}</p>
              <p class="text-sm text-gray-600">Ингредиенты: ${ingredientNames.join(', ') || 'Нет'}</p>
              <div class="flex gap-2 mt-2">
                <button onclick="loadDishForEdit('${dish.id}')" class="bg-yellow-600 text-white p-2 rounded flex-1">Редактировать</button>
                <button onclick="deleteDish('${dish.id}')" class="bg-red-600 text-white p-2 rounded flex-1">Удалить</button>
              </div>
            </div>
          </div>`;
        list.appendChild(dishCard);
      });
    } catch (error) {
      console.error('Ошибка загрузки блюд:', error);
      alert('Ошибка при загрузке блюд: ' + error.message);
    }
  }

  async function deleteDish(dishId) {
    try {
      await db.collection('dishes').doc(dishId).delete();
      await loadDishes();
      if (document.getElementById('order-ingredients-list')) {
        await loadOrderIngredients();
      }
      alert('Блюдо успешно удалено!');
    } catch (error) {
      console.error('Ошибка удаления блюда:', error);
      alert('Ошибка при удалении блюда: ' + error.message);
    }
  }

  function toggleDishDetails(button) {
    const details = button.nextElementSibling;
    if (details.classList.contains('hidden')) {
      details.classList.remove('hidden');
      button.textContent = 'Скрыть';
    } else {
      details.classList.add('hidden');
      button.textContent = 'Развернуть';
    }
  }

  async function toggleDishVisibility(dishId, isActive) {
    try {
      await db.collection('dishes').doc(dishId).update({ is_active_dish: isActive });
      await loadDishes();
      if (document.getElementById('order-ingredients-list')) {
        await loadOrderIngredients();
      }
      alert(`Блюдо успешно ${isActive ? 'активировано' : 'деактивировано'}!`);
    } catch (error) {
      console.error('Ошибка изменения видимости блюда:', error);
      alert('Ошибка при изменении видимости блюда: ' + error.message);
    }
  }

  async function loadIngredientsSelect() {
    const searchInputs = document.querySelectorAll('#ingredient-search:not([data-loaded])');
    if (!searchInputs.length) return;
    try {
      const ingredients = await db.collection('ingredients').orderBy('name_product').get();
      searchInputs.forEach(input => {
        const datalist = input.nextElementSibling;
        if (datalist && datalist.id === 'ingredient-options') {
          datalist.innerHTML = '';
          if (ingredients.empty) {
            datalist.innerHTML += '<option value="" disabled>Ингредиенты отсутствуют</option>';
          } else {
            ingredients.forEach(ing => {
              datalist.innerHTML += `<option value="${ing.id}" data-name="${ing.data().name_product}">${ing.data().name_product}</option>`;
            });
          }
          input.dataset.loaded = 'true';
          input.addEventListener('input', (e) => {
            const value = e.target.value.toLowerCase();
            const options = datalist.querySelectorAll('option');
            options.forEach(opt => {
              const name = opt.dataset.name.toLowerCase();
              opt.style.display = name.startsWith(value) ? '' : 'none';
            });
          });
        }
      });
    } catch (error) {
      console.error('Ошибка загрузки ингредиентов:', error);
    }
  }

  function addIngredientRow() {
    const container = document.getElementById('ingredients-container');
    const row = document.createElement('div');
    row.className = 'ingredient-row mb-2 flex items-center';
    row.innerHTML = `
      <input type="text" id="ingredient-search" class="border p-2 mr-2 w-2/3 rounded" placeholder="Введите название ингредиента" list="ingredient-options">
      <datalist id="ingredient-options"></datalist>
      <input type="number" class="dish-ingredient-quantity border p-2 w-1/3 rounded" placeholder="Количество" min="0" step="0.1">
      <button onclick="this.parentElement.remove();" class="bg-red-600 text-white p-1 rounded ml-2">Удалить</button>
    `;
    container.appendChild(row);
    loadIngredientsSelect();
  }

  async function addIngredient(name_product, stock_quantity_product, current_price_product, supplier_product, weight_product) {
    if (!name_product || !current_price_product) {
      alert('Пожалуйста, заполните обязательные поля: название и цену.');
      return;
    }
    try {
      const ingredientsSnapshot = await db.collection('ingredients').get();
      const existingIngredient = ingredientsSnapshot.docs.find(doc => doc.data().name_product.toLowerCase() === name_product.toLowerCase());
      if (existingIngredient) {
        alert('Ингредиент с таким названием уже существует!');
        return;
      }

      const ingredientRef = await db.collection('ingredients').add({
        name_product,
        stock_quantity_product: stock_quantity_product >= 0 ? stock_quantity_product : 0,
        current_price_product,
        supplier_product: supplier_product || '',
        weight_product: weight_product != null && weight_product >= 0 ? weight_product : 0
      });
      await db.collection('ingredients').doc(ingredientRef.id).update({ product_id: ingredientRef.id });
      await loadInventory();
      await loadIngredientsSelect();
      if (document.getElementById('order-ingredients-list')) {
        await loadOrderIngredients();
      }
      cancelIngredientForm();
      alert('Ингредиент успешно добавлен!');
    } catch (error) {
      console.error('Ошибка добавления ингредиента:', error);
      alert('Ошибка при добавлении ингредиента: ' + error.message);
    }
  }

  async function editIngredient(ingredientId) {
    const name_product = document.getElementById('ingredient-name')?.value;
    const stock_quantity_product = parseInt(document.getElementById('ingredient-quantity')?.value) || 0;
    const current_price_product = parseFloat(document.getElementById('ingredient-price')?.value) || 0;
    const supplier_product = document.getElementById('ingredient-supplier')?.value || '';
    const weight_product = document.getElementById('ingredient-weight')?.value ? parseFloat(document.getElementById('ingredient-weight').value) : null;
    if (!name_product || !current_price_product) {
      alert('Пожалуйста, заполните обязательные поля: название и цену.');
      return;
    }
    try {
      await db.collection('ingredients').doc(ingredientId).update({
        name_product,
        stock_quantity_product: stock_quantity_product >= 0 ? stock_quantity_product : 0,
        current_price_product,
        supplier_product,
        weight_product: weight_product != null && weight_product >= 0 ? weight_product : 0
      });
      await loadInventory();
      await loadIngredientsSelect();
      if (document.getElementById('order-ingredients-list')) {
        await loadOrderIngredients();
      }
      cancelIngredientForm();
      alert('Ингредиент успешно обновлен!');
    } catch (error) {
      console.error('Ошибка обновления ингредиента:', error);
      alert('Ошибка при обновлении ингредиента: ' + error.message);
    }
  }

  async function loadIngredientForEdit(ingredientId) {
    try {
      if (!auth.currentUser) {
        console.error('Пользователь не авторизован');
        alert('Пожалуйста, войдите в систему.');
        return;
      }
      const ingredient = await db.collection('ingredients').doc(ingredientId).get();
      if (!ingredient.exists) {
        console.error('Ингредиент с ID', ingredientId, 'не найден');
        alert('Ингредиент не найден');
        return;
      }
      const ingData = ingredient.data();

      showIngredientForm();

      const nameField = document.getElementById('ingredient-name');
      const quantityField = document.getElementById('ingredient-quantity');
      const priceField = document.getElementById('ingredient-price');
      const supplierField = document.getElementById('ingredient-supplier');
      const weightField = document.getElementById('ingredient-weight');

      if (!nameField || !quantityField || !priceField || !supplierField || !weightField) {
        console.error('Один или несколько полей формы не найдены');
        alert('Ошибка: Некоторые поля формы отсутствуют. Обновите страницу.');
        return;
      }

      nameField.value = ingData.name_product || '';
      quantityField.value = ingData.stock_quantity_product || 0;
      priceField.value = ingData.current_price_product || 0;
      supplierField.value = ingData.supplier_product || '';
      weightField.value = ingData.weight_product != null ? ingData.weight_product : '';

      document.getElementById('ingredient-form').dataset.ingredientId = ingredientId;
      document.getElementById('ingredient-form-button').textContent = 'Сохранить';
    } catch (error) {
      console.error('Ошибка загрузки ингредиента для редактирования:', error);
      alert('Ошибка при загрузке ингредиента: ' + error.message);
    }
  }

  async function deleteIngredient(ingredientId) {
    try {
      await db.collection('ingredients').doc(ingredientId).delete();
      await loadInventory();
      await loadIngredientsSelect();
      if (document.getElementById('order-ingredients-list')) {
        await loadOrderIngredients();
      }
      alert('Ингредиент успешно удален!');
    } catch (error) {
      console.error('Ошибка удаления ингредиента:', error);
      alert('Ошибка при удалении ингредиента: ' + error.message);
    }
  }

  async function updateIngredientQuantity(ingredientId, newQuantity) {
    try {
      const parsedQuantity = parseInt(newQuantity) || 0;
      await db.collection('ingredients').doc(ingredientId).update({
        stock_quantity_product: parsedQuantity >= 0 ? parsedQuantity : 0
      });
      await loadInventory();
      if (document.getElementById('order-ingredients-list')) {
        await loadOrderIngredients();
      }
    } catch (error) {
      console.error('Ошибка обновления количества ингредиента:', error);
      alert('Ошибка при обновлении количества: ' + error.message);
    }
  }

  async function loadInventory() {
    const list = document.getElementById('inventory-list');
    if (!list) return;
    try {
      const ingredients = await db.collection('ingredients').get();
      const dishes = await db.collection('dishes').get();
      const usedIngredientIds = new Set();
      dishes.forEach(dish => {
        const dishData = dish.data();
        if (dishData.ingredients) {
          dishData.ingredients.forEach(ing => usedIngredientIds.add(ing.ingredient_id));
        }
      });

      list.innerHTML = `
        <table class="min-w-full border-collapse border border-gray-300">
          <thead>
            <tr class="bg-gray-100">
              <th class="border border-gray-300 p-2">Название</th>
              <th class="border border-gray-300 p-2">Количество</th>
              <th class="border border-gray-300 p-2">Цена ($)</th>
              <th class="border border-gray-300 p-2">Вес (кг)</th>
              <th class="border border-gray-300 p-2">Поставщик</th>
              <th class="border border-gray-300 p-2">Действия</th>
            </tr>
          </thead>
          <tbody>
          </tbody>
        </table>
      `;
      const tbody = list.querySelector('tbody');
      if (ingredients.empty) {
        tbody.innerHTML = '<tr><td colspan="6" class="border border-gray-300 p-2 text-center">Ингредиенты отсутствуют</td></tr>';
        return;
      }

      let showUnused = document.getElementById('toggle-unused')?.dataset.show === 'true';
      const sortedIngredients = Array.from(ingredients.docs).sort((a, b) => 
        (a.data().name_product || '').localeCompare(b.data().name_product || '')
      );
      sortedIngredients.forEach(ing => {
        const ingData = ing.data();
        if (!showUnused && !usedIngredientIds.has(ing.id)) return;

        const row = document.createElement('tr');
        row.innerHTML = `
          <td class="border border-gray-300 p-2">${ingData.name_product || 'Без названия'}</td>
          <td class="border border-gray-300 p-2" onclick="editQuantity('${ing.id}', ${ingData.stock_quantity_product || 0})">
            <span class="quantity-display">${ingData.stock_quantity_product || 0}</span>
            <input type="number" class="quantity-input border p-2 w-full hidden" id="quantity-${ing.id}" value="${ingData.stock_quantity_product || 0}" onblur="saveQuantity('${ing.id}')" onkeypress="if(event.key === 'Enter') saveQuantity('${ing.id}')">
          </td>
          <td class="border border-gray-300 p-2">${ingData.current_price_product || 0}</td>
          <td class="border border-gray-300 p-2">${ingData.weight_product != null ? ingData.weight_product : 0}</td>
          <td class="border border-gray-300 p-2">${ingData.supplier_product || 'Нет'}</td>
          <td class="border border-gray-300 p-2 text-center">
            <button onclick="loadIngredientForEdit('${ing.id}')" class="bg-yellow-600 p-2 rounded">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
              </svg>
            </button>
            <button onclick="deleteIngredient('${ing.id}')" class="bg-red-600 p-2 rounded ml-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          </td>
        `;
        tbody.appendChild(row);
      });
    } catch (error) {
      console.error('Ошибка загрузки инвентаря:', error);
      alert('Ошибка при загрузке инвентаря: ' + error.message);
    }
  }

  async function loadOrderIngredients() {
    const list = document.getElementById('order-ingredients-list');
    if (!list) {
      console.warn('Элемент с id="order-ingredients-list" не найден, загрузка пропущена.');
      return;
    }
    try {
      const dishes = await db.collection('dishes').get();
      const ingredients = await db.collection('ingredients').get();
      const ingredientMap = {};
      ingredients.forEach(ing => {
        ingredientMap[ing.id] = {
          name: ing.data().name_product || 'Неизвестный ингредиент',
          stock: ing.data().stock_quantity_product || 0,
          price: ing.data().current_price_product || 0,
          weight: ing.data().weight_product != null ? ing.data().weight_product : 0,
          supplier: ing.data().supplier_product || 'Неизвестно'
        };
      });

      const requiredIngredients = {};
      dishes.forEach(dish => {
        const dishData = dish.data();
        if (dishData.min_dish > 0 && dishData.is_active_dish) {
          (dishData.ingredients || []).forEach(ing => {
            const required = ing.quantity * dishData.min_dish;
            if (!requiredIngredients[ing.ingredient_id]) {
              requiredIngredients[ing.ingredient_id] = { quantity: 0, name: ingredientMap[ing.ingredient_id]?.name || 'Неизвестный ингредиент' };
            }
            requiredIngredients[ing.ingredient_id].quantity += required;
          });
        }
      });

      list.innerHTML = '<h2 class="text-xl font-bold mb-2">Заказать</h2>';
      let hasItems = false;
      const supplierOrders = {};
      for (const [ingId, data] of Object.entries(requiredIngredients)) {
        const stock = ingredientMap[ingId]?.stock || 0;
        const needed = data.quantity - stock;
        if (needed > 0) {
          const supplier = ingredientMap[ingId]?.supplier || 'Неизвестно';
          if (!supplierOrders[supplier]) {
            supplierOrders[supplier] = [];
          }
          supplierOrders[supplier].push({
            name: data.name,
            quantity: needed,
            price: ingredientMap[ingId]?.price || 0,
            weight: ingredientMap[ingId]?.weight || 0
          });
          hasItems = true;
        }
      }

      if (!hasItems) {
        list.innerHTML += '<p class="text-gray-500">Ингредиенты для заказа отсутствуют</p>';
      } else {
        for (const [supplier, items] of Object.entries(supplierOrders)) {
          list.innerHTML += `<h3 class="text-lg font-semibold mt-2">Заказ ${supplier}:</h3>`;
          let totalCost = 0;
          let totalWeight = 0;
          items.forEach(item => {
            const cost = item.quantity * item.price;
            const weight = item.quantity * item.weight;
            totalCost += cost;
            totalWeight += weight;
            list.innerHTML += `${item.name} ${item.quantity} шт ${weight.toFixed(3)} кг ${cost.toFixed(2)}$<br>`;
          });
          list.innerHTML += `Итого: ${totalWeight.toFixed(3)} кг ${totalCost.toFixed(2)}$<br>`;
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки заказа ингредиентов:', error);
      alert('Ошибка при загрузке заказа ингредиентов: ' + error.message);
    }
  }

  async function loadPersonalReport() {
    const list = document.getElementById('personal-report-list');
    if (!list) return;
    try {
      const orders = await db.collection('orders').where('user', '==', auth.currentUser?.uid || 'anonymous').get();
      list.innerHTML = '';
      if (orders.empty) {
        list.innerHTML = '<li>Заказы отсутствуют</li>';
        return;
      }
      orders.forEach(order => {
        list.innerHTML += `<li>Заказ: ${order.data().items.map(item => item.name).join(', ')}</li>`;
      });
    } catch (error) {
      console.error('Ошибка загрузки личной отчетности:', error);
    }
  }

  async function generateGeneralReport() {
    const list = document.getElementById('general-report-list');
    if (!list) return;
    try {
      const start = new Date(document.getElementById('report-start')?.value);
      const end = new Date(document.getElementById('report-end')?.value);
      const orders = await db.collection('orders').where('timestamp', '>=', start).where('timestamp', '<=', end).get();
      list.innerHTML = '';
      if (orders.empty) {
        list.innerHTML = '<li>Заказы отсутствуют</li>';
        return;
      }
      orders.forEach(order => {
        list.innerHTML += `<li>Заказ: ${order.data().items.map(item => item.name).join(', ')}</li>`;
      });
    } catch (error) {
      console.error('Ошибка генерации общей отчетности:', error);
    }
  }

  async function addEmployee() {
    const name = document.getElementById('employee-name')?.value;
    const phone = document.getElementById('employee-phone')?.value;
    if (!name || !phone) {
      alert('Пожалуйста, заполните все поля для сотрудника.');
      return;
    }
    try {
      await db.collection('employees').add({ name, phone });
      await loadEmployees();
      alert('Сотрудник успешно добавлен!');
    } catch (error) {
      console.error('Ошибка добавления сотрудника:', error);
      alert('Ошибка при добавлении сотрудника: ' + error.message);
    }
  }

  async function loadEmployees() {
    const list = document.getElementById('employees-list');
    if (!list) return;
    try {
      const employees = await db.collection('employees').get();
      list.innerHTML = '';
      if (employees.empty) {
        list.innerHTML = '<li>Сотрудники отсутствуют</li>';
        return;
      }
      employees.forEach(emp => {
        list.innerHTML += `<li>${emp.data().name} - ${emp.data().phone}</li>`;
      });
    } catch (error) {
      console.error('Ошибка загрузки сотрудников:', error);
    }
  }

  async function loadDeliveryMenu() {
    const deliveryMenu = document.getElementById('delivery-menu');
    if (!deliveryMenu) return;
    try {
      const categories = await db.collection('categories').where('isVisible', '==', true).orderBy('number', 'asc').get();
      const dishes = await db.collection('dishes').where('is_active_dish', '==', true).get();
      deliveryMenu.innerHTML = '';
      if (categories.empty) {
        deliveryMenu.innerHTML = '<p>Категории отсутствуют</p>';
        return;
      }
      categories.forEach(cat => {
        const catDiv = document.createElement('div');
        catDiv.innerHTML = `<h2 class="text-xl">${cat.data().name}</h2>`;
        dishes.forEach(dish => {
          if (dish.data().category_id === cat.id) {
            const dishData = dish.data();
            catDiv.innerHTML += `
              <div class="border p-2 flex items-center">
                ${dishData.image_dish ? `<img src="${dishData.image_dish}" alt="${dishData.name_dish}" class="w-16 h-16 object-cover mr-4">` : ''}
                <div>
                  <p class="font-bold">${dishData.name_dish} - ${dishData.price_dish} $</p>
                  <p>${dishData.description_dish || 'Нет описания'}</p>
                  <p>Вес: ${dishData.weight_dish != null ? dishData.weight_dish : 0} г</p>
                  <p>Мин. порций: ${dishData.min_dish || 0}</p>
                  <button onclick="addToDeliveryOrder('${dish.id}', '${dishData.name_dish}', ${dishData.price_dish})" class="bg-blue-600 text-white p-1 rounded mt-2">Добавить</button>
                </div>
              </div>`;
          }
        });
        deliveryMenu.appendChild(catDiv);
      });
    } catch (error) {
      console.error('Ошибка загрузки меню доставки:', error);
    }
  }

  let deliveryOrderItems = [];
  function addToDeliveryOrder(dishId, name, price) {
    deliveryOrderItems.push({ dishId, name, price });
    renderDeliveryOrder();
  }

  function renderDeliveryOrder() {
    const orderList = document.getElementById('delivery-order-items');
    if (!orderList) return;
    orderList.innerHTML = '';
    if (deliveryOrderItems.length === 0) {
      orderList.innerHTML = '<li>Заказ пуст</li>';
      return;
    }
    deliveryOrderItems.forEach(item => {
      orderList.innerHTML += `<li>${item.name} - ${item.price} $</li>`;
    });
  }

  async function placeDeliveryOrder() {
    const address = document.getElementById('delivery-address')?.value;
    const comment = document.getElementById('delivery-comment')?.value || '';
    if (!address) {
      alert('Пожалуйста, укажите адрес доставки.');
      return;
    }
    try {
      await db.collection('delivery-orders').add({
        items: deliveryOrderItems,
        address,
        comment,
        user: auth.currentUser?.uid || 'anonymous',
        status: 'pending',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      deliveryOrderItems = [];
      renderDeliveryOrder();
      alert('Заказ доставки оформлен!');
      if (document.getElementById('order-ingredients-list')) {
        await loadOrderIngredients();
      }
    } catch (error) {
      console.error('Ошибка оформления заказа доставки:', error);
      alert('Ошибка при оформлении заказа доставки: ' + error.message);
    }
  }

  async function updateDeliveryStatus(orderId, status) {
    try {
      await db.collection('delivery-orders').doc(orderId).update({ status });
      await loadDeliveryOrders();
    } catch (error) {
      console.error('Ошибка обновления статуса доставки:', error);
      alert('Ошибка при обновлении статуса доставки: ' + error.message);
    }
  }

  async function loadDeliveryOrders() {
    const list = document.getElementById('delivery-orders-list');
    if (!list) return;
    try {
      const orders = await db.collection('delivery-orders').get();
      list.innerHTML = '';
      if (orders.empty) {
        list.innerHTML = '<li>Заказы доставки отсутствуют</li>';
        return;
      }
      orders.forEach(order => {
        list.innerHTML += `
          <li>
            Заказ: ${order.data().items.map(item => item.name).join(', ')}<br>
            Адрес: ${order.data().address}<br>
            Статус: ${order.data().status}
            <button onclick="updateDeliveryStatus('${order.id}', 'confirmed')" class="bg-green-600 text-white p-1 rounded ml-2">Подтвердить</button>
            <button onclick="updateDeliveryStatus('${order.id}', 'cancelled')" class="bg-red-600 text-white p-1 rounded ml-2">Отменить</button>
          </li>`;
      });
    } catch (error) {
      console.error('Ошибка загрузки заказов доставки:', error);
    }
  }

  function cancelDishForm() {
    const form = document.getElementById('dish-form');
    if (form) {
      form.classList.add('hidden');
      form.dataset.dishId = '';
      document.getElementById('dish-name').value = '';
      document.getElementById('dish-description').value = '';
      document.getElementById('dish-price').value = '';
      document.getElementById('dish-category').value = '';
      document.getElementById('dish-image').value = '';
      document.getElementById('dish-image-preview').style.display = 'none';
      document.getElementById('dish-active').checked = false;
      document.getElementById('dish-weight').value = '';
      document.getElementById('dish-min-portions').value = '';
      document.getElementById('ingredients-container').innerHTML = `
        <div class="ingredient-row mb-2 flex items-center">
          <input type="text" id="ingredient-search" class="border p-2 mr-2 w-2/3 rounded" placeholder="Введите название ингредиента" list="ingredient-options">
          <datalist id="ingredient-options"></datalist>
          <input type="number" class="dish-ingredient-quantity border p-2 w-1/3 rounded" placeholder="Количество" min="0" step="0.1">
        </div>
      `;
      document.getElementById('dish-form-button').textContent = 'Добавить блюдо';
      loadIngredientsSelect();
    }
  }

  function cancelCategoryForm() {
    const form = document.getElementById('category-form');
    if (form) {
      form.classList.add('hidden');
      form.dataset.categoryId = '';
      document.getElementById('category-name').value = '';
      document.getElementById('category-number').value = '';
      document.getElementById('category-visible').checked = true;
      document.getElementById('category-form-button').textContent = 'Добавить категорию';
    }
  }

  function cancelIngredientForm() {
    const form = document.getElementById('ingredient-form');
    if (form) {
      form.classList.add('hidden');
      form.dataset.ingredientId = '';
      document.getElementById('ingredient-name').value = '';
      document.getElementById('ingredient-quantity').value = '';
      document.getElementById('ingredient-price').value = '';
      document.getElementById('ingredient-supplier').value = '';
      document.getElementById('ingredient-weight').value = '';
      document.getElementById('ingredient-form-button').textContent = 'Сохранить';
    }
  }

  function showDishForm() {
    const form = document.getElementById('dish-form');
    if (form) {
      form.classList.remove('hidden');
      cancelDishForm();
    } else {
      console.warn('Форма с id="dish-form" не найдена.');
    }
  }

  function showCategoryForm() {
    const form = document.getElementById('category-form');
    if (form) {
      form.classList.remove('hidden');
      cancelCategoryForm();
    } else {
      console.warn('Форма с id="category-form" не найдена.');
    }
  }

  function showIngredientForm() {
    const form = document.getElementById('ingredient-form');
    if (form) {
      form.classList.remove('hidden');
      cancelIngredientForm();
    } else {
      console.warn('Форма с id="ingredient-form" не найдена.');
    }
  }

  function editQuantity(ingredientId, currentValue) {
    const td = document.querySelector(`td[onclick="editQuantity('${ingredientId}', ${currentValue})"]`);
    const span = td?.querySelector('.quantity-display');
    const input = td?.querySelector('.quantity-input');
    if (td && span && input) {
      span.classList.add('hidden');
      input.classList.remove('hidden');
      input.value = currentValue;
      input.focus();
    }
  }

  function saveQuantity(ingredientId) {
    const td = document.querySelector(`td[onclick*="${ingredientId}"]`);
    if (!td) {
      console.error('Не найден элемент td для ingredientId:', ingredientId);
      return;
    }
    const input = td.querySelector('.quantity-input');
    const span = td.querySelector('.quantity-display');
    if (input && span) {
      const newQuantity = input.value;
      input.classList.add('hidden');
      span.classList.remove('hidden');
      span.textContent = newQuantity;
      updateIngredientQuantity(ingredientId, newQuantity);
    }
  }

  function toggleUnusedIngredients() {
    const button = document.getElementById('toggle-unused');
    const showUnused = button?.dataset.show === 'true';
    button.dataset.show = !showUnused;
    button.textContent = !showUnused ? 'Скрыть неиспользуемые' : 'Показать все';
    loadInventory();
  }

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      const navElement = document.getElementById('nav');
      if (navElement) {
        await loadNav();
        document.getElementById('nav-login')?.classList.add('hidden');
        document.querySelectorAll('#nav a:not(#nav-login), #logout').forEach(el => el.classList.remove('hidden'));
        await loadMenu();
        await loadPromocodes();
        await loadDishes();
        await loadCategories();
        await loadCategoryList();
        await loadInventory();
        if (document.getElementById('order-ingredients-list')) {
          await loadOrderIngredients();
        }
        await loadPersonalReport();
        await loadEmployees();
        await loadDeliveryMenu();
        await loadDeliveryOrders();
        await loadIngredientsSelect();
      }
    } else {
      document.getElementById('nav-login')?.classList.remove('hidden');
      document.querySelectorAll('#nav a:not(#nav-login), #logout').forEach(el => el.classList.add('hidden'));
      if (window.location.pathname !== '/bar/index.html') {
        window.location.href = '/bar/index.html';
      }
    }
  });

  window.login = login;
  window.logout = logout;
  window.addToOrder = addToOrder;
  window.placeOrder = placeOrder;
  window.addPromocode = addPromocode;
  window.addDish = addDish;
  window.editDish = editDish;
  window.loadDishForEdit = loadDishForEdit;
  window.addCategory = addCategory;
  window.loadCategoryForEdit = loadCategoryForEdit;
  window.deleteCategory = deleteCategory;
  window.toggleCategoryVisibility = toggleCategoryVisibility;
  window.addIngredient = addIngredient;
  window.editIngredient = editIngredient;
  window.loadIngredientForEdit = loadIngredientForEdit;
  window.deleteIngredient = deleteIngredient;
  window.addEmployee = addEmployee;
  window.addToDeliveryOrder = addToDeliveryOrder;
  window.placeDeliveryOrder = placeDeliveryOrder;
  window.updateDeliveryStatus = updateDeliveryStatus;
  window.generateGeneralReport = generateGeneralReport;
  window.addIngredientRow = addIngredientRow;
  window.loadIngredientsSelect = loadIngredientsSelect;
  window.editQuantity = editQuantity;
  window.saveQuantity = saveQuantity;
  window.showIngredientForm = showIngredientForm;
  window.cancelIngredientForm = cancelIngredientForm;
  window.toggleUnusedIngredients = toggleUnusedIngredients;
  window.showDishForm = showDishForm;
  window.showCategoryForm = showCategoryForm;
  window.toggleDishVisibility = toggleDishVisibility;
  window.cancelDishForm = cancelDishForm;
  window.cancelCategoryForm = cancelCategoryForm;
  window.toggleDishDetails = toggleDishDetails;
  window.deleteDish = deleteDish;
  window.toggleCategoryFilter = toggleCategoryFilter;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
