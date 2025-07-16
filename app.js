function initializeApp() {
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDK не загружен. Проверьте подключение скриптов.');
    return;
  }

  const firebaseConfig = {
    apiKey: "AIzaSyB3PAQQTpeTxlaeT7cIXqqspGDOcAkBQog",
    authDomain: "evabar-ac842.firebaseapp.com",
    databaseURL: "https://evabar-ac842-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "evabar-ac842",
    storageBucket: "evabar-ac842.firebasestorage.app",
    messagingSenderId: "938549088383",
    appId: "1:938549088383:web:9a6d241040520ccfef6f4a"
  };
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  const SALARY_RATE = 0.1;

  async function loadNav() {
    try {
      const response = await fetch('nav.html');
      const navHtml = await response.text();
      document.getElementById('nav').innerHTML = navHtml;
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
      window.location.href = 'menu.html';
    } catch (error) {
      console.error('Ошибка входа:', error);
      alert('Ошибка входа: Неверный email или пароль. Пожалуйста, проверьте данные или сбросьте пароль.');
    }
  }

  async function logout() {
    try {
      await auth.signOut();
      window.location.href = 'index.html';
    } catch (error) {
      console.error('Ошибка выхода:', error);
      alert('Ошибка выхода: ' + error.message);
    }
  }

  async function calculateDishMetrics(ingredients) {
    let price_current_dish = 0;
    let min_dish = Number.MAX_SAFE_INTEGER;

    if (!ingredients || ingredients.length === 0) {
      console.warn('Массив ingredients пустой или отсутствует');
      return { price_current_dish: 0, min_dish: 0 };
    }

    for (const ing of ingredients) {
      if (!ing.ingredient_id || !ing.quantity) {
        console.warn(`Некорректный ингредиент: ${JSON.stringify(ing)}`);
        continue;
      }
      const ingredient = await db.collection('ingredients').doc(ing.ingredient_id).get();
      if (ingredient.exists) {
        const ingData = ingredient.data();
        price_current_dish += ing.quantity * ingData.current_price_product;
        const availableDishes = Math.floor(ingData.stock_quantity_product / ing.quantity);
        min_dish = Math.min(min_dish, availableDishes);
      } else {
        console.warn(`Ингредиент ${ing.ingredient_id} не найден`);
      }
    }

    return { price_current_dish, min_dish };
  }

  async function loadMenu() {
    if (!document.getElementById('categories')) return;
    try {
      const categories = await db.collection('categories')
        .where('isVisible', '==', true)
        .orderBy('number', 'asc')
        .get();
      const dishes = await db.collection('dishes')
        .where('is_active_dish', '==', true)
        .get();
      const categoriesDiv = document.getElementById('categories');
      categoriesDiv.innerHTML = '';
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
                  <p>${dishData.description_dish}</p>
                  <p>Вес: ${dishData.weight_dish} г</p>
                  <p>Доступно: ${dishData.min_dish} порций</p>
                  <button onclick="addToOrder('${dish.id}', '${dishData.name_dish}', ${dishData.price_dish})" class="bg-blue-600 text-white p-1 rounded mt-2">Добавить</button>
                </div>
              </div>`;
          }
        });
        categoriesDiv.appendChild(catDiv);
      });
    } catch (error) {
      console.error('Ошибка загрузки меню:', error);
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
    orderItems.forEach(item => {
      orderList.innerHTML += `<li>${item.name} - ${item.price} $</li>`;
    });
  }

  async function placeOrder() {
    const comment = document.getElementById('order-comment')?.value;
    try {
      await db.collection('orders').add({
        items: orderItems,
        comment,
        user: auth.currentUser.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      for (const item of orderItems) {
        const dish = await db.collection('dishes').doc(item.dishId).get();
        const ingredients = dish.data().ingredients || [];
        for (const ing of ingredients) {
          const ingredientRef = db.collection('ingredients').doc(ing.ingredient_id);
          const ingredient = await ingredientRef.get();
          await ingredientRef.update({
            stock_quantity_product: ingredient.data().stock_quantity_product - ing.quantity
          });
        }
      }
      orderItems = [];
      renderOrder();
      alert('Заказ оформлен!');
    } catch (error) {
      console.error('Ошибка оформления заказа:', error);
      alert('Ошибка при оформлении заказа: ' + error.message);
    }
  }

  async function addPromocode() {
    const code = document.getElementById('promo-code')?.value;
    const discount = parseInt(document.getElementById('promo-discount')?.value);
    try {
      await db.collection('promocodes').add({ code, discount });
      loadPromocodes();
    } catch (error) {
      console.error('Ошибка добавления промокода:', error);
    }
  }

  async function loadPromocodes() {
    if (!document.getElementById('promocodes-list')) return;
    try {
      const promocodes = await db.collection('promocodes').get();
      const list = document.getElementById('promocodes-list');
      list.innerHTML = '';
      promocodes.forEach(promo => {
        list.innerHTML += `<li>${promo.data().code} - ${promo.data().discount}%</li>`;
      });
    } catch (error) {
      console.error('Ошибка загрузки промокодов:', error);
    }
  }

  async function addDish() {
    const name_dish = document.getElementById('dish-name')?.value;
    const description_dish = document.getElementById('dish-description')?.value;
    const price_dish = parseInt(document.getElementById('dish-price')?.value);
    const category_id = document.getElementById('dish-category')?.value;
    const image_dish = document.getElementById('dish-image')?.value;
    const is_active_dish = document.getElementById('dish-active')?.checked;
    const weight_dish = parseInt(document.getElementById('dish-weight')?.value);
    const ingredientRows = document.querySelectorAll('.ingredient-row');
    const ingredients = Array.from(ingredientRows).map(row => ({
      ingredient_id: row.querySelector('.dish-ingredient').value,
      quantity: parseInt(row.querySelector('.dish-ingredient-quantity').value) || 0
    })).filter(ing => ing.ingredient_id && ing.quantity > 0);

    if (!name_dish || !price_dish || !category_id || !weight_dish || ingredients.length === 0) {
      alert('Пожалуйста, заполните все обязательные поля и добавьте хотя бы один ингредиент.');
      return;
    }

    try {
      const { price_current_dish, min_dish } = await calculateDishMetrics(ingredients);
      if (price_current_dish === 0 && min_dish === 0) {
        alert('Ошибка: Не удалось рассчитать себестоимость. Проверьте, что все ингредиенты существуют.');
        return;
      }
      const salary_dish = (price_dish - price_current_dish) * SALARY_RATE;
      const price_profit_dish = price_dish - price_current_dish - salary_dish;

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
      loadDishes();
      document.getElementById('dish-form').reset();
      document.querySelectorAll('.ingredient-row:not(:first-child)').forEach(row => row.remove());
      loadIngredientsSelect();
      alert('Блюдо успешно добавлено!');
    } catch (error) {
      console.error('Ошибка добавления блюда:', error);
      alert('Ошибка при добавлении блюда: ' + error.message);
    }
  }

  async function editDish(dishId) {
    const name_dish = document.getElementById('dish-name')?.value;
    const description_dish = document.getElementById('dish-description')?.value;
    const price_dish = parseInt(document.getElementById('dish-price')?.value);
    const category_id = document.getElementById('dish-category')?.value;
    const image_dish = document.getElementById('dish-image')?.value;
    const is_active_dish = document.getElementById('dish-active')?.checked;
    const weight_dish = parseInt(document.getElementById('dish-weight')?.value);
    const ingredientRows = document.querySelectorAll('.ingredient-row');
    const ingredients = Array.from(ingredientRows).map(row => ({
      ingredient_id: row.querySelector('.dish-ingredient').value,
      quantity: parseInt(row.querySelector('.dish-ingredient-quantity').value) || 0
    })).filter(ing => ing.ingredient_id && ing.quantity > 0);

    if (!name_dish || !price_dish || !category_id || !weight_dish || ingredients.length === 0) {
      alert('Пожалуйста, заполните все обязательные поля и добавьте хотя бы один ингредиент.');
      return;
    }

    try {
      const { price_current_dish, min_dish } = await calculateDishMetrics(ingredients);
      if (price_current_dish === 0 && min_dish === 0) {
        alert('Ошибка: Не удалось рассчитать себестоимость. Проверьте, что все ингредиенты существуют.');
        return;
      }
      const salary_dish = (price_dish - price_current_dish) * SALARY_RATE;
      const price_profit_dish = price_dish - price_current_dish - salary_dish;

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

      loadDishes();
      document.getElementById('dish-form').reset();
      document.querySelectorAll('.ingredient-row:not(:first-child)').forEach(row => row.remove());
      loadIngredientsSelect();
      document.getElementById('dish-form').dataset.dishId = '';
      document.getElementById('dish-form-button').textContent = 'Добавить блюдо';
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
      document.getElementById('dish-name').value = dishData.name_dish;
      document.getElementById('dish-description').value = dishData.description_dish;
      document.getElementById('dish-price').value = dishData.price_dish;
      document.getElementById('dish-category').value = dishData.category_id;
      document.getElementById('dish-image').value = dishData.image_dish || '';
      document.getElementById('dish-active').checked = dishData.is_active_dish;
      document.getElementById('dish-weight').value = dishData.weight_dish;

      const container = document.getElementById('ingredients-container');
      container.innerHTML = `
        <div class="ingredient-row mb-2 flex">
          <select class="dish-ingredient border p-2 mr-2 w-2/3"></select>
          <input type="number" class="dish-ingredient-quantity border p-2 w-1/3" placeholder="Количество">
        </div>
      `;
      dishData.ingredients.forEach((ing, index) => {
        if (index > 0) {
          const row = document.createElement('div');
          row.className = 'ingredient-row mb-2 flex';
          row.innerHTML = `
            <select class="dish-ingredient border p-2 mr-2 w-2/3"></select>
            <input type="number" class="dish-ingredient-quantity border p-2 w-1/3" placeholder="Количество">
            <button onclick="this.parentElement.remove();" class="bg-red-600 text-white p-1 rounded ml-2">Удалить</button>
          `;
          container.appendChild(row);
        }
        const row = container.querySelectorAll('.ingredient-row')[index];
        row.querySelector('.dish-ingredient-quantity').value = ing.quantity;
      });

      await loadIngredientsSelect();
      dishData.ingredients.forEach((ing, index) => {
        const row = container.querySelectorAll('.ingredient-row')[index];
        row.querySelector('.dish-ingredient').value = ing.ingredient_id;
      });

      document.getElementById('dish-form').dataset.dishId = dishId;
      document.getElementById('dish-form-button').textContent = 'Сохранить изменения';
    } catch (error) {
      console.error('Ошибка загрузки блюда для редактирования:', error);
      alert('Ошибка при загрузке блюда: ' + error.message);
    }
  }

  async function addCategory() {
    const name = document.getElementById('category-name')?.value;
    const isVisible = document.getElementById('category-visible')?.checked;
    const number = parseInt(document.getElementById('category-number')?.value) || 0;
    try {
      await db.collection('categories').add({ name, isVisible, number });
      loadCategories();
      loadCategoryList();
    } catch (error) {
      console.error('Ошибка добавления категории:', error);
    }
  }

  async function loadCategories() {
    if (!document.getElementById('dish-category')) return;
    try {
      const categories = await db.collection('categories').orderBy('number', 'asc').get();
      const select = document.getElementById('dish-category');
      select.innerHTML = '<option value="">Выберите категорию</option>';
      categories.forEach(cat => {
        select.innerHTML += `<option value="${cat.id}">${cat.data().name}</option>`;
      });
    } catch (error) {
      console.error('Ошибка загрузки категорий:', error);
    }
  }

  async function loadCategoryList() {
    if (!document.getElementById('categories-list')) return;
    try {
      const categories = await db.collection('categories').orderBy('number', 'asc').get();
      const list = document.getElementById('categories-list');
      list.innerHTML = '';
      categories.forEach(cat => {
        list.innerHTML += `
          <li>
            ${cat.data().name} (Порядок: ${cat.data().number}, Видимость: ${cat.data().isVisible ? 'Вкл' : 'Выкл'})
            <button onclick="toggleCategoryVisibility('${cat.id}', ${!cat.data().isVisible})" class="bg-blue-600 text-white p-1 rounded ml-2">
              ${cat.data().isVisible ? 'Скрыть' : 'Показать'}
            </button>
          </li>`;
      });
    } catch (error) {
      console.error('Ошибка загрузки списка категорий:', error);
    }
  }

  async function toggleCategoryVisibility(categoryId, isVisible) {
    try {
      await db.collection('categories').doc(categoryId).update({ isVisible });
      loadCategoryList();
    } catch (error) {
      console.error('Ошибка изменения видимости категории:', error);
    }
  }

  async function loadDishes() {
    if (!document.getElementById('dishes-list')) return;
    try {
      const dishes = await db.collection('dishes').get();
      const categories = await db.collection('categories').get();
      const categoryMap = {};
      categories.forEach(cat => {
        categoryMap[cat.id] = cat.data().name;
      });
      const list = document.getElementById('dishes-list');
      list.innerHTML = '';
      for (const dish of dishes.docs) {
        const dishData = dish.data();
        const ingredients = dishData.ingredients || [];
        let ingredientNames = [];
        for (const ing of ingredients) {
          const ingredient = await db.collection('ingredients').doc(ing.ingredient_id).get();
          if (ingredient.exists) {
            ingredientNames.push(`${ingredient.data().name_product} (${ing.quantity})`);
          } else {
            ingredientNames.push(`Неизвестный ингредиент (${ing.quantity})`);
          }
        }
        list.innerHTML += `
          <li>
            ${dishData.name_dish} - ${dishData.price_dish} $ (Категория: ${categoryMap[dishData.category_id] || dishData.category_id})<br>
            Описание: ${dishData.description_dish}<br>
            Себестоимость: ${dishData.price_current_dish} $<br>
            Зарплата сотрудника: ${dishData.salary_dish} $<br>
            Прибыль: ${dishData.price_profit_dish} $<br>
            Фото: ${dishData.image_dish || 'Нет'}<br>
            Активно: ${dishData.is_active_dish ? 'Да' : 'Нет'}<br>
            Мин. порций: ${dishData.min_dish}<br>
            Вес: ${dishData.weight_dish} г<br>
            Ингредиенты: ${ingredientNames.join(', ') || 'Нет'}<br>
            <button onclick="loadDishForEdit('${dish.id}')" class="bg-yellow-600 text-white p-1 rounded mt-2">Редактировать</button>
          </li>`;
      }
    } catch (error) {
      console.error('Ошибка загрузки блюд:', error);
    }
  }

  async function loadIngredientsSelect() {
    const selects = document.querySelectorAll('.dish-ingredient');
    if (!selects.length) return;
    try {
      const ingredients = await db.collection('ingredients').get();
      selects.forEach(select => {
        select.innerHTML = '<option value="">Выберите ингредиент</option>';
        ingredients.forEach(ing => {
          select.innerHTML += `<option value="${ing.id}">${ing.data().name_product}</option>`;
        });
      });
    } catch (error) {
      console.error('Ошибка загрузки ингредиентов:', error);
    }
  }

  function addIngredientRow() {
    const container = document.getElementById('ingredients-container');
    const row = document.createElement('div');
    row.className = 'ingredient-row mb-2 flex';
    row.innerHTML = `
      <select class="dish-ingredient border p-2 mr-2 w-2/3"></select>
      <input type="number" class="dish-ingredient-quantity border p-2 w-1/3" placeholder="Количество">
      <button onclick="this.parentElement.remove();" class="bg-red-600 text-white p-1 rounded ml-2">Удалить</button>
    `;
    container.appendChild(row);
    loadIngredientsSelect();
  }

  async function addIngredient() {
    const name_product = document.getElementById('ingredient-name')?.value;
    const stock_quantity_product = parseInt(document.getElementById('ingredient-quantity')?.value);
    const current_price_product = parseFloat(document.getElementById('ingredient-price')?.value);
    const supplier_product = document.getElementById('ingredient-supplier')?.value || '';
    const weight_product = parseInt(document.getElementById('ingredient-weight')?.value);
    try {
      const ingredientRef = await db.collection('ingredients').add({
        name_product,
        stock_quantity_product,
        current_price_product,
        supplier_product,
        weight_product
      });
      await db.collection('ingredients').doc(ingredientRef.id).update({ product_id: ingredientRef.id });
      loadInventory();
      loadIngredientsSelect();
    } catch (error) {
      console.error('Ошибка добавления ингредиента:', error);
      alert('Ошибка при добавлении ингредиента: ' + error.message);
    }
  }

  async function loadInventory() {
    if (!document.getElementById('inventory-list')) return;
    try {
      const ingredients = await db.collection('ingredients').get();
      const list = document.getElementById('inventory-list');
      list.innerHTML = '';
      ingredients.forEach(ing => {
        const ingData = ing.data();
        list.innerHTML += `
          <li>
            ${ingData.name_product} - ${ingData.stock_quantity_product} (Цена: ${ingData.current_price_product} $, Вес: ${ingData.weight_product} г, Поставщик: ${ingData.supplier_product || 'Нет'})
          </li>`;
      });
    } catch (error) {
      console.error('Ошибка загрузки инвентаря:', error);
    }
  }

  async function loadOrderIngredients() {
    if (!document.getElementById('order-ingredients-list')) return;
    try {
      const ingredients = await db.collection('ingredients').get();
      const list = document.getElementById('order-ingredients-list');
      list.innerHTML = '';
      ingredients.forEach(ing => {
        if (ing.data().stock_quantity_product < 10) {
          list.innerHTML += `<li>${ing.data().name_product} - Нужно: ${10 - ing.data().stock_quantity_product}</li>`;
        }
      });
    } catch (error) {
      console.error('Ошибка загрузки заказа ингредиентов:', error);
    }
  }

  async function placeIngredientOrder() {
    alert('Заказ ингредиентов оформлен!');
  }

  async function loadPersonalReport() {
    if (!document.getElementById('personal-report-list')) return;
    try {
      const orders = await db.collection('orders').where('user', '==', auth.currentUser.uid).get();
      const list = document.getElementById('personal-report-list');
      list.innerHTML = '';
      orders.forEach(order => {
        list.innerHTML += `<li>Заказ: ${order.data().items.map(item => item.name).join(', ')}</li>`;
      });
    } catch (error) {
      console.error('Ошибка загрузки личной отчетности:', error);
    }
  }

  async function generateGeneralReport() {
    if (!document.getElementById('general-report-list')) return;
    try {
      const start = new Date(document.getElementById('report-start')?.value);
      const end = new Date(document.getElementById('report-end')?.value);
      const orders = await db.collection('orders').where('timestamp', '>=', start).where('timestamp', '<=', end).get();
      const list = document.getElementById('general-report-list');
      list.innerHTML = '';
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
    try {
      await db.collection('employees').add({ name, phone });
      loadEmployees();
    } catch (error) {
      console.error('Ошибка добавления сотрудника:', error);
    }
  }

  async function loadEmployees() {
    if (!document.getElementById('employees-list')) return;
    try {
      const employees = await db.collection('employees').get();
      const list = document.getElementById('employees-list');
      list.innerHTML = '';
      employees.forEach(emp => {
        list.innerHTML += `<li>${emp.data().name} - ${emp.data().phone}</li>`;
      });
    } catch (error) {
      console.error('Ошибка загрузки сотрудников:', error);
    }
  }

  async function loadDeliveryMenu() {
    if (!document.getElementById('delivery-menu')) return;
    try {
      const categories = await db.collection('categories')
        .where('isVisible', '==', true)
        .orderBy('number', 'asc')
        .get();
      const dishes = await db.collection('dishes')
        .where('is_active_dish', '==', true)
        .get();
      const deliveryMenu = document.getElementById('delivery-menu');
      deliveryMenu.innerHTML = '';
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
                  <p>${dishData.description_dish}</p>
                  <p>Вес: ${dishData.weight_dish} г</p>
                  <p>Доступно: ${dishData.min_dish} порций</p>
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
    deliveryOrderItems.forEach(item => {
      orderList.innerHTML += `<li>${item.name} - ${item.price} $</li>`;
    });
  }

  async function placeDeliveryOrder() {
    const address = document.getElementById('delivery-address')?.value;
    const comment = document.getElementById('delivery-comment')?.value;
    try {
      await db.collection('delivery-orders').add({
        items: deliveryOrderItems,
        address,
        comment,
        user: auth.currentUser.uid,
        status: 'pending',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      deliveryOrderItems = [];
      renderDeliveryOrder();
      alert('Заказ доставки оформлен!');
    } catch (error) {
      console.error('Ошибка оформления заказа доставки:', error);
      alert('Ошибка при оформлении заказа доставки: ' + error.message);
    }
  }

  async function loadDeliveryOrders() {
    if (!document.getElementById('delivery-orders-list')) return;
    try {
      const orders = await db.collection('delivery-orders').get();
      const list = document.getElementById('delivery-orders-list');
      list.innerHTML = '';
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

  async function updateDeliveryStatus(orderId, status) {
    try {
      await db.collection('delivery-orders').doc(orderId).update({ status });
      loadDeliveryOrders();
    } catch (error) {
      console.error('Ошибка обновления статуса доставки:', error);
    }
  }

  auth.onAuthStateChanged(user => {
    loadNav().then(() => {
      if (user) {
        document.getElementById('nav-login')?.classList.add('hidden');
        document.querySelectorAll('#nav a:not(#nav-login), #logout').forEach(el => el.classList.remove('hidden'));
        loadMenu();
        loadPromocodes();
        loadDishes();
        loadCategories();
        loadCategoryList();
        loadInventory();
        loadOrderIngredients();
        loadPersonalReport();
        loadEmployees();
        loadDeliveryMenu();
        loadDeliveryOrders();
        loadIngredientsSelect();
      } else {
        document.getElementById('nav-login')?.classList.remove('hidden');
        document.querySelectorAll('#nav a:not(#nav-login), #logout').forEach(el => el.classList.add('hidden'));
        if (window.location.pathname !== '/index.html' && window.location.pathname !== '/bar/index.html') {
          window.location.href = 'index.html';
        }
      }
    });
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
  window.toggleCategoryVisibility = toggleCategoryVisibility;
  window.addIngredient = addIngredient;
  window.placeIngredientOrder = placeIngredientOrder;
  window.addEmployee = addEmployee;
  window.addToDeliveryOrder = addToDeliveryOrder;
  window.placeDeliveryOrder = placeDeliveryOrder;
  window.updateDeliveryStatus = updateDeliveryStatus;
  window.generateGeneralReport = generateGeneralReport;
  window.addIngredientRow = addIngredientRow;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
