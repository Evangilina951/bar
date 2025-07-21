let firebaseApp = null;
let showAllDishes = false;

function initializeApp() {
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDK не загружен. Проверьте подключение скриптов.');
    return;
  }
  console.log('Firebase загружен успешно.');

  if (!firebase.apps || firebase.apps.length === 0) {
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
      firebaseApp = firebase.initializeApp(firebaseConfig);
      console.log('Firebase инициализирован.');
    } catch (error) {
      console.error('Ошибка инициализации Firebase:', error);
      return;
    }
  } else {
    firebaseApp = firebase.app();
    console.log('Firebase уже инициализирован, используется существующее приложение.');
  }

  const auth = firebaseApp.auth();
  const db = firebaseApp.firestore();
  const SALARY_RATE = 0.4;
  let currentCategoryFilter = null;
  let showAllIngredients = false;

  function loadNav() {
    const navElement = document.getElementById('nav');
    if (!navElement) {
      console.warn('Элемент с id="nav" не найден. Загрузка nav.html пропущена.');
      return;
    }
    navElement.innerHTML = `
      <nav>
        <a href="/bar/menu.html">Меню</a>
        <a href="/bar/promocodes.html">Промокоды</a>
        <a href="/bar/dishes.html">Блюда</a>
        <a href="/bar/inventory.html">Инвентаризация</a>
        <a href="/bar/personal-report.html">Личная отчетность</a>
        <a href="/bar/general-report.html">Общая отчетность</a>
        <a href="/bar/employees.html">Сотрудники</a>
        <a href="/bar/delivery.html">Доставка</a>
        <a href="/bar/delivery-orders.html">Заказы доставки</a>
        <button onclick="logout()">Выход</button>
      </nav>
    `;
    console.log('Навигация вставлена в DOM');
  }

  function login() {
    if (!firebaseApp) {
      alert('Firebase не инициализирован. Перезагрузите страницу.');
      return;
    }
    const email = document.getElementById('email')?.value;
    const password = document.getElementById('password')?.value;
    if (!email || !password) {
      alert('Ошибка входа: Введите email и пароль.');
      return;
    }
    auth.signInWithEmailAndPassword(email, password)
      .then(() => {
        window.location.href = '/bar/menu.html';
      })
      .catch((error) => {
        console.error('Ошибка входа:', error);
        alert('Ошибка входа: Неверный email или пароль.');
      });
  }

  function logout() {
    if (!firebaseApp) {
      alert('Firebase не инициализирован. Перезагрузите страницу.');
      return;
    }
    auth.signOut()
      .then(() => {
        window.location.href = '/bar/index.html';
      })
      .catch((error) => {
        console.error('Ошибка выхода:', error);
        alert('Ошибка выхода: ' + error.message);
      });
  }

  async function calculateDishMetrics(ingredients) {
    if (!firebaseApp) {
      console.error('Firebase не инициализирован.');
      return { price_current_dish: 0 };
    }
    let price_current_dish = 0;
    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      console.warn('Массив ingredients пустой, не является массивом или отсутствует:', ingredients);
      return { price_current_dish: 0 };
    }
    const promises = ingredients.map(async (ing) => {
      if (!ing.ingredient_id || ing.quantity == null || isNaN(ing.quantity)) {
        console.warn(`Некорректный ингредиент: ${JSON.stringify(ing)}`);
        return 0;
      }
      try {
        const ingredient = await db.collection('ingredients').doc(ing.ingredient_id).get();
        if (ingredient.exists) {
          const ingData = ingredient.data();
          const price = ingData.current_price_product || 0;
          const quantity = parseFloat(ing.quantity) || 0;
          return quantity * price;
        } else {
          console.warn(`Ингредиент ${ing.ingredient_id} не найден в базе данных`);
          return 0;
        }
      } catch (error) {
        console.error(`Ошибка получения ингредиента ${ing.ingredient_id}:`, error);
        return 0;
      }
    });
    try {
      const prices = await Promise.all(promises);
      price_current_dish = prices.reduce((sum, price) => sum + (isNaN(price) ? 0 : price), 0);
      return { price_current_dish: Math.round(price_current_dish * 100) / 100 };
    } catch (error) {
      console.error('Ошибка при расчете себестоимости:', error);
      return { price_current_dish: 0 };
    }
  }

  async function addDish() {
    if (!firebaseApp) {
      alert('Firebase не инициализирован. Перезагрузите страницу.');
      return;
    }
    const form = document.getElementById('dish-form');
    if (!form) {
      console.error('Форма с id="dish-form" не найдена в DOM');
      alert('Ошибка: Форма для добавления блюда не найдена.');
      return;
    }

    const name_dish = document.getElementById('dish-name')?.value;
    const price_dish = parseFloat(document.getElementById('dish-price')?.value) || 0;
    const category_id = document.getElementById('dish-category')?.value;
    const is_active_dish = document.getElementById('dish-active')?.checked || false;
    const weight_dish = document.getElementById('dish-weight')?.value ? parseFloat(document.getElementById('dish-weight').value) : null;
    const min_dish = parseInt(document.getElementById('dish-min-portions')?.value) || 0;
    const image_dish = document.getElementById('dish-image')?.value || '';
    const ingredientRows = document.querySelectorAll('.ingredient-row');
    const ingredients = Array.from(ingredientRows).map((row) => {
      const ingredientId = row.querySelector('input[id^="ingredient-search-"]')?.dataset.ingredientId || '';
      const quantity = parseFloat(row.querySelector('.dish-ingredient-quantity')?.value) || 0;
      return { ingredient_id: ingredientId, quantity: quantity };
    }).filter((ing) => ing.ingredient_id && ing.quantity > 0);

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
      const salary_dish = Math.round((price_dish - price_current_dish) * SALARY_RATE * 100) / 100;
      const price_profit_dish = Math.round((price_dish - price_current_dish - salary_dish) * 100) / 100;

      const dishRef = await db.collection('dishes').add({
        category_id,
        name_dish,
        price_dish,
        price_current_dish,
        salary_dish,
        price_profit_dish,
        is_active_dish,
        min_dish,
        weight_dish,
        image_dish,
        ingredients
      });
      await db.collection('dishes').doc(dishRef.id).update({ dish_id: dishRef.id });
      await loadDishes();
      cancelDishForm();
      alert('Блюдо успешно добавлено!');
    } catch (error) {
      console.error('Ошибка добавления блюда:', error);
      alert('Ошибка при добавлении блюда: ' + error.message);
    }
  }

  async function loadDishes() {
    if (!firebaseApp) {
      console.error('Firebase не инициализирован.');
      return;
    }
    const list = document.getElementById('dishes-list');
    if (!list) {
      console.error('Элемент с id="dishes-list" не найден в DOM');
      return;
    }
    const filterCategory = showAllDishes ? null : currentCategoryFilter;
    const dishesQuery = filterCategory ? db.collection('dishes').where('category_id', '==', filterCategory) : db.collection('dishes');
    try {
      const dishes = await dishesQuery.get();
      const categories = await db.collection('categories').get();
      const categoryMap = {};
      categories.forEach((cat) => categoryMap[cat.id] = cat.data().name);
      list.innerHTML = '';
      if (dishes.empty) {
        list.innerHTML = '<p class="text-gray-500">Блюда отсутствуют</p>';
        return;
      }
      const dishPromises = dishes.docs.map(async (dish) => {
        const dishData = dish.data();
        const ingredients = dishData.ingredients || [];
        const ingredientNames = await Promise.all(ingredients.map(async (ing) => {
          try {
            const ingredient = await db.collection('ingredients').doc(ing.ingredient_id).get();
            return ingredient.exists ? `${ingredient.data().name_product} (${ing.quantity})` : `Неизвестный ингредиент (${ing.quantity})`;
          } catch (error) {
            console.error(`Ошибка загрузки ингредиента ${ing.ingredient_id}:`, error);
            return `Неизвестный ингредиент (${ing.quantity})`;
          }
        }));
        let price_current_dish = dishData.price_current_dish || 0;
        if (!price_current_dish || isNaN(price_current_dish)) {
          const metrics = await calculateDishMetrics(ingredients);
          price_current_dish = metrics.price_current_dish;
          await db.collection('dishes').doc(dish.id).update({
            price_current_dish,
            salary_dish: Math.round((dishData.price_dish - price_current_dish) * SALARY_RATE * 100) / 100,
            price_profit_dish: Math.round((dishData.price_dish - price_current_dish - ((dishData.price_dish - price_current_dish) * SALARY_RATE)) * 100) / 100
          });
        }
        return { dish, ingredientNames, price_current_dish };
      });
      const dishDataArray = await Promise.all(dishPromises);
      dishDataArray.forEach(({ dish, ingredientNames, price_current_dish }) => {
        renderDishCard(dish, ingredientNames, categoryMap, price_current_dish);
      });
    } catch (error) {
      console.error('Ошибка загрузки блюд:', error);
      alert('Ошибка при загрузке блюд: ' + error.message);
    }
  }

  function renderDishCard(dish, ingredientNames, categoryMap, price_current_dish) {
    const list = document.getElementById('dishes-list');
    const dishCard = document.createElement('div');
    dishCard.className = 'dish-card';
    const dishData = dish.data();
    const ingredientsList = ingredientNames.length > 0 
      ? `<ul class="list-disc pl-4">${ingredientNames.map(name => `<li>${name}</li>`).join('')}</ul>` 
      : 'Нет';
    dishCard.innerHTML = `
      <div class="flex flex-col h-full">
        <div class="dish-image-container">
          ${dishData.image_dish ? `<img src="${dishData.image_dish}" alt="${dishData.name_dish}" class="dish-image">` : '<div class="dish-placeholder"></div>'}
        </div>
        <p class="dish-name">${dishData.name_dish}</p>
        <p class="dish-price">${dishData.price_dish} $</p>
        <p class="dish-category">${categoryMap[dishData.category_id] || 'Нет'}</p>
        <button onclick="toggleDishDetails(this)" class="bg-gray-600 text-white p-1 rounded mt-2 text-sm">Развернуть</button>
        <div class="dish-details hidden">
          <p class="text-sm text-gray-600">Себестоимость: ${Math.round(price_current_dish * 100) / 100} $</p>
          <p class="text-sm text-gray-600">Зарплата: ${Math.round(dishData.salary_dish * 100) / 100} $</p>
          <p class="text-sm text-gray-600">Прибыль: ${Math.round(dishData.price_profit_dish * 100) / 100} $</p>
          <p class="text-sm text-gray-600">Вес: ${dishData.weight_dish != null ? dishData.weight_dish : 0} г</p>
          <p class="text-sm text-gray-600">Мин. порций: ${dishData.min_dish || 0}</p>
          <p class="text-sm text-gray-600">Ингредиенты:</p>
          ${ingredientsList}
          <div class="flex gap-2 mt-2">
            <button onclick="loadDishForEdit('${dish.id}')" class="edit-btn bg-yellow-600 text-white p-2 rounded flex-1">✏️</button>
            <button onclick="deleteDish('${dish.id}')" class="delete-btn bg-red-600 text-white p-2 rounded flex-1">🗑️</button>
            <button onclick="toggleDishVisibility('${dish.id}', ${!dishData.is_active_dish})" class="${dishData.is_active_dish ? 'toggle-active-btn bg-green-600' : 'toggle-inactive-btn bg-gray-600'} text-white p-2 rounded flex-1">${dishData.is_active_dish ? '✔️' : '❌'}</button>
          </div>
        </div>
      </div>`;
    list.appendChild(dishCard);
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

  async function loadDishForEdit(dishId) {
    if (!firebaseApp) {
      alert('Firebase не инициализирован. Перезагрузите страницу.');
      return;
    }
    const form = document.getElementById('dish-form');
    if (!form) {
      console.error('Форма с id="dish-form" не найдена в DOM');
      alert('Ошибка: Форма для редактирования блюда не найдена.');
      return;
    }

    try {
      const dish = await db.collection('dishes').doc(dishId).get();
      if (!dish.exists) {
        alert('Блюдо не найдено');
        return;
      }
      const dishData = dish.data();

      // Проверка всех элементов формы
      const elements = {
        'dish-name': document.getElementById('dish-name'),
        'dish-price': document.getElementById('dish-price'),
        'dish-category': document.getElementById('dish-category'),
        'dish-weight': document.getElementById('dish-weight'),
        'dish-min-portions': document.getElementById('dish-min-portions'),
        'dish-active': document.getElementById('dish-active'),
        'dish-image': document.getElementById('dish-image'),
        'ingredients-container': document.getElementById('ingredients-container'),
        'dish-form-button': document.getElementById('dish-form-button')
      };
      for (const [id, element] of Object.entries(elements)) {
        if (!element) {
          console.error(`Элемент с id="${id}" не найден в DOM`);
          alert(`Ошибка: Элемент с id="${id}" не найден. Проверьте HTML.`);
          return;
        }
      }

      // Отображаем форму перед заполнением
      form.classList.remove('hidden');

      // Заполняем поля формы, игнорируя устаревшие поля
      elements['dish-name'].value = dishData.name_dish || '';
      elements['dish-price'].value = dishData.price_dish || 0;
      elements['dish-category'].value = dishData.category_id || '';
      elements['dish-weight'].value = dishData.weight_dish != null ? dishData.weight_dish : '';
      elements['dish-min-portions'].value = dishData.min_dish || 0;
      elements['dish-active'].checked = dishData.is_active_dish || false;
      elements['dish-image'].value = dishData.image_dish || '';

      // Загружаем ингредиенты
      const container = elements['ingredients-container'];
      if (container) {
        container.innerHTML = '<datalist id="ingredient-options"></datalist>';
        const ingredientPromises = (dishData.ingredients || []).map(async (ing, index) => {
          try {
            const ingredient = await db.collection('ingredients').doc(ing.ingredient_id).get();
            const name = ingredient.exists ? ingredient.data().name_product : 'Неизвестный ингредиент';
            return `
              <div class="ingredient-row flex flex-col md:flex-row gap-4">
                <div class="flex-1">
                  <label class="block mb-1">Ингредиент:</label>
                  <input type="text" id="ingredient-search-${index}" class="border p-2 w-full rounded" placeholder="Введите название ингредиента" list="ingredient-options" value="${name}" data-ingredient-id="${ing.ingredient_id || ''}">
                </div>
                <div class="flex-1">
                  <label class="block mb-1">Количество:</label>
                  <input type="number" class="dish-ingredient-quantity border p-2 w-full rounded" placeholder="Количество" min="0" step="0.1" value="${ing.quantity || 0}">
                </div>
                ${index > 0 ? `<button onclick="removeIngredientRow(this)" class="bg-red-600 text-white rounded">🗑️</button>` : ''}
              </div>
            `;
          } catch (error) {
            console.error(`Ошибка загрузки ингредиента ${ing.ingredient_id}:`, error);
            return '';
          }
        });
        const ingredientRows = await Promise.all(ingredientPromises);
        container.innerHTML += ingredientRows.join('');
        if (!dishData.ingredients || dishData.ingredients.length === 0) {
          container.innerHTML = `
            <datalist id="ingredient-options"></datalist>
            <div class="ingredient-row flex flex-col md:flex-row gap-4">
              <div class="flex-1">
                <label class="block mb-1">Ингредиент:</label>
                <input type="text" id="ingredient-search-0" class="border p-2 w-full rounded" placeholder="Введите название ингредиента" list="ingredient-options">
              </div>
              <div class="flex-1">
                <label class="block mb-1">Количество:</label>
                <input type="number" class="dish-ingredient-quantity border p-2 w-full rounded" placeholder="Количество" min="0" step="0.1">
              </div>
            </div>
          `;
        }
        loadIngredientsSelect();
      }

      form.dataset.dishId = dishId;
      elements['dish-form-button'].onclick = editDish;
      elements['dish-form-button'].textContent = 'Сохранить';
    } catch (error) {
      console.error('Ошибка загрузки блюда для редактирования:', error);
      alert('Ошибка при загрузке блюда: ' + error.message);
    }
  }

  async function editDish() {
    if (!firebaseApp) {
      alert('Firebase не инициализирован. Перезагрузите страницу.');
      return;
    }
    const form = document.getElementById('dish-form');
    if (!form) {
      console.error('Форма с id="dish-form" не найдена в DOM');
      alert('Ошибка: Форма для редактирования блюда не найдена.');
      return;
    }
    const dishId = form.dataset.dishId;
    if (!dishId) {
      alert('Нет идентификатора блюда для редактирования.');
      return;
    }

    const name_dish = document.getElementById('dish-name')?.value;
    const price_dish = parseFloat(document.getElementById('dish-price')?.value) || 0;
    const category_id = document.getElementById('dish-category')?.value;
    const is_active_dish = document.getElementById('dish-active')?.checked || false;
    const weight_dish = document.getElementById('dish-weight')?.value ? parseFloat(document.getElementById('dish-weight').value) : null;
    const min_dish = parseInt(document.getElementById('dish-min-portions')?.value) || 0;
    const image_dish = document.getElementById('dish-image')?.value || '';
    const ingredientRows = document.querySelectorAll('.ingredient-row');
    const ingredients = Array.from(ingredientRows).map((row) => {
      const ingredientId = row.querySelector('input[id^="ingredient-search-"]')?.dataset.ingredientId || '';
      const quantity = parseFloat(row.querySelector('.dish-ingredient-quantity')?.value) || 0;
      return { ingredient_id: ingredientId, quantity: quantity };
    }).filter((ing) => ing.ingredient_id && ing.quantity > 0);

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
      const salary_dish = Math.round((price_dish - price_current_dish) * SALARY_RATE * 100) / 100;
      const price_profit_dish = Math.round((price_dish - price_current_dish - salary_dish) * 100) / 100;

      await db.collection('dishes').doc(dishId).update({
        category_id,
        name_dish,
        price_dish,
        price_current_dish,
        salary_dish,
        price_profit_dish,
        is_active_dish,
        min_dish,
        weight_dish,
        image_dish,
        ingredients
      });
      await loadDishes();
      cancelDishForm();
      alert('Блюдо успешно обновлено!');
    } catch (error) {
      console.error('Ошибка обновления блюда:', error);
      alert('Ошибка при обновлении блюда: ' + error.message);
    }
  }

  function deleteDish(dishId) {
    if (!firebaseApp) {
      alert('Firebase не инициализирован. Перезагрузите страницу.');
      return;
    }
    db.collection('dishes').doc(dishId).delete()
      .then(() => {
        loadDishes();
        alert('Блюдо успешно удалено!');
      })
      .catch((error) => {
        console.error('Ошибка удаления блюда:', error);
        alert('Ошибка при удаления блюда: ' + error.message);
      });
  }

  function toggleDishVisibility(dishId, isActive) {
    if (!firebaseApp) {
      alert('Firebase не инициализирован. Перезагрузите страницу.');
      return;
    }
    db.collection('dishes').doc(dishId).update({ is_active_dish: isActive })
      .then(() => {
        loadDishes();
      })
      .catch((error) => {
        console.error('Ошибка изменения видимости блюда:', error);
        alert('Ошибка при изменении видимости блюда: ' + error.message);
      });
  }

  async function addCategory() {
    if (!firebaseApp) {
      alert('Firebase не инициализирован. Перезагрузите страницу.');
      return;
    }
    const form = document.getElementById('category-form');
    if (!form) {
      console.error('Форма с id="category-form" не найдена в DOM');
      alert('Ошибка: Форма для добавления категории не найдена.');
      return;
    }

    const name = document.getElementById('category-name')?.value;
    const isVisible = document.getElementById('category-visible')?.checked || false;
    const number = parseInt(document.getElementById('category-number')?.value) || 0;
    const categoryId = form.dataset.categoryId || null;

    if (!name) {
      alert('Пожалуйста, введите название категории.');
      return;
    }

    try {
      const existingCategories = await db.collection('categories').where('number', '==', number).get();
      if (!existingCategories.empty && (!categoryId || existingCategories.docs.some(doc => doc.id !== categoryId))) {
        alert('Категория с таким порядковым номером уже существует. Выберите другой номер.');
        return;
      }

      if (categoryId) {
        await db.collection('categories').doc(categoryId).update({ name, isVisible, number });
        loadCategories();
        loadCategoryList();
        cancelCategoryForm();
        alert('Категория успешно обновлена!');
      } else {
        await db.collection('categories').add({ name, isVisible, number });
        loadCategories();
        loadCategoryList();
        cancelCategoryForm();
        alert('Категория успешно добавлена!');
      }
    } catch (error) {
      console.error('Ошибка добавления/обновления категории:', error);
      alert('Ошибка при добавлении/обновлении категории: ' + error.message);
    }
  }

  function loadCategories() {
    if (!firebaseApp) {
      console.error('Firebase не инициализирован.');
      return;
    }
    const select = document.getElementById('dish-category');
    if (!select) return;
    db.collection('categories').orderBy('number', 'asc').get()
      .then((categories) => {
        if (select) {
          select.innerHTML = '<option value="">Выберите категорию</option>';
          categories.forEach((cat) => {
            select.innerHTML += `<option value="${cat.id}">${cat.data().name}</option>`;
          });
        }
      })
      .catch((error) => {
        console.error('Ошибка загрузки категорий:', error);
      });
  }

  function loadCategoryList() {
    if (!firebaseApp) {
      console.error('Firebase не инициализирован.');
      return;
    }
    const list = document.getElementById('categories-list');
    if (!list) return;
    db.collection('categories').orderBy('number', 'asc').get()
      .then((categories) => {
        list.innerHTML = '<h2 class="text-xl font-bold mb-2">Список категорий</h2>';
        if (categories.empty) {
          list.innerHTML += '<li class="text-gray-500">Категории отсутствуют</li>';
          return;
        }
        categories.forEach((cat) => {
          const catData = cat.data();
          list.innerHTML += `
            <li class="flex items-center justify-between p-2 border-b">
              <span class="cursor-pointer" onclick="toggleCategoryFilter('${cat.id}', '${catData.name}')">${catData.number}. ${catData.name}</span>
              <div class="flex gap-2">
                <button onclick="loadCategoryForEdit('${cat.id}')" class="edit-btn bg-yellow-600 text-white p-2 rounded flex-1">✏️</button>
                <button onclick="deleteCategory('${cat.id}')" class="delete-btn bg-red-600 text-white p-2 rounded flex-1">🗑️</button>
                <button onclick="toggleCategoryVisibility('${cat.id}', ${!catData.isVisible})" class="${catData.isVisible ? 'toggle-active-btn bg-green-600' : 'toggle-inactive-btn bg-gray-600'} text-white p-2 rounded flex-1">${catData.isVisible ? '✔️' : '❌'}</button>
              </div>
            </li>`;
        });
      })
      .catch((error) => {
        console.error('Ошибка загрузки списка категорий:', error);
        if (error.code === 'failed-precondition' && error.message.includes('requires an index')) {
          alert('Для загрузки категорий требуется индекс в Firestore. Пожалуйста, создайте его в консоли Firebase.');
        } else {
          alert('Ошибка при загрузке категорий: ' + error.message);
        }
      });
  }

  function toggleCategoryFilter(categoryId, categoryName) {
    currentCategoryFilter = currentCategoryFilter === categoryId ? null : categoryId;
    showAllDishes = false;
    loadDishes();
  }

  function toggleShowAllDishes() {
    showAllDishes = true;
    currentCategoryFilter = null;
    loadDishes();
  }

  function loadCategoryForEdit(categoryId) {
    if (!firebaseApp) {
      alert('Firebase не инициализирован. Перезагрузите страницу.');
      return;
    }
    const form = document.getElementById('category-form');
    if (!form) {
      console.error('Форма с id="category-form" не найдена в DOM');
      alert('Ошибка: Форма для редактирования категории не найдена.');
      return;
    }

    db.collection('categories').doc(categoryId).get()
      .then((category) => {
        if (!category.exists) {
          alert('Категория не найдена');
          return;
        }
        const catData = category.data();
        document.getElementById('category-name').value = catData.name || '';
        document.getElementById('category-number').value = catData.number || 0;
        document.getElementById('category-visible').checked = catData.isVisible || false;
        form.dataset.categoryId = categoryId;
        document.getElementById('category-form-button').textContent = 'Сохранить';
        form.classList.remove('hidden');
      })
      .catch((error) => {
        console.error('Ошибка загрузки категории для редактирования:', error);
        alert('Ошибка при загрузке категории: ' + error.message);
      });
  }

  function deleteCategory(categoryId) {
    if (!firebaseApp) {
      alert('Firebase не инициализирован. Перезагрузите страницу.');
      return;
    }
    db.collection('dishes').where('category_id', '==', categoryId).get()
      .then((dishes) => {
        if (!dishes.empty) {
          alert('Нельзя удалить категорию, так как в ней есть блюда.');
          return;
        }
        db.collection('categories').doc(categoryId).delete()
          .then(() => {
            loadCategories();
            loadCategoryList();
            alert('Категория успешно удалена!');
          })
          .catch((error) => {
            console.error('Ошибка удаления категории:', error);
            alert('Ошибка при удалении категории: ' + error.message);
          });
      })
      .catch((error) => {
        console.error('Ошибка проверки блюд:', error);
        alert('Ошибка при проверке блюд: ' + error.message);
      });
  }

  function toggleCategoryVisibility(categoryId, isVisible) {
    if (!firebaseApp) {
      alert('Firebase не инициализирован. Перезагрузите страницу.');
      return;
    }
    db.collection('categories').doc(categoryId).update({ isVisible })
      .then(() => {
        loadCategoryList();
        loadDishes();
      })
      .catch((error) => {
        console.error('Ошибка изменения видимости категории:', error);
        alert('Ошибка при изменении видимости категории: ' + error.message);
      });
  }

  function loadInventory() {
    if (!firebaseApp) {
      console.error('Firebase не инициализирован.');
      return;
    }
    const list = document.getElementById('inventory-list');
    const orderList = document.getElementById('order-list');
    if (!list || !orderList) return;

    db.collection('ingredients').get()
      .then((ingredients) => {
        db.collection('dishes').get()
          .then((dishes) => {
            const usedIngredientIds = new Set();
            const minIngredientRequirements = {};

            dishes.forEach((dish) => {
              const dishData = dish.data();
              if (dishData.ingredients && dishData.min_dish) {
                dishData.ingredients.forEach((ing) => {
                  if (!minIngredientRequirements[ing.ingredient_id]) {
                    minIngredientRequirements[ing.ingredient_id] = 0;
                  }
                  minIngredientRequirements[ing.ingredient_id] += ing.quantity * dishData.min_dish;
                  usedIngredientIds.add(ing.ingredient_id);
                });
              }
            });

            list.innerHTML = `
              <table class="order-table-container w-full border-collapse">
                <thead>
                  <tr>
                    <th class="border p-2">Название</th>
                    <th class="border p-2">Количество</th>
                    <th class="border p-2">Цена ($)</th>
                    <th class="border p-2">Вес (кг)</th>
                    <th class="border p-2">Поставщик</th>
                    <th class="border p-2">Действия</th>
                  </tr>
                </thead>
                <tbody>
                </tbody>
              </table>
            `;
            const tbody = list.querySelector('tbody');
            if (ingredients.empty) {
              tbody.innerHTML = '<tr><td colspan="6" class="border p-2 text-center">Ингредиенты отсутствуют</td></tr>';
              return;
            }

            const sortedIngredients = Array.from(ingredients.docs).sort((a, b) =>
              (a.data().name_product || '').localeCompare(b.data().name_product || '')
            );

            sortedIngredients.forEach((ing) => {
              const ingData = ing.data();
              if (!showAllIngredients && !usedIngredientIds.has(ing.id)) return;

              const row = document.createElement('tr');
              row.innerHTML = `
                <td class="border p-2">${ingData.name_product || 'Без названия'}</td>
                <td class="border p-2 quantity-cell" data-ingredient-id="${ing.id}">${ingData.stock_quantity_product || 0}</td>
                <td class="border p-2">${ingData.current_price_product || 0}</td>
                <td class="border p-2">${ingData.weight_product != null ? ingData.weight_product : 0}</td>
                <td class="border p-2">${ingData.supplier_product || 'Нет'}</td>
                <td class="border p-2 flex gap-2">
                  <button onclick="loadIngredientForEdit('${ing.id}')" class="edit-btn bg-yellow-600 text-white p-2 rounded">✏️</button>
                  <button onclick="deleteIngredient('${ing.id}')" class="delete-btn bg-red-600 text-white p-2 rounded">🗑️</button>
                </td>
              `;
              tbody.appendChild(row);
            });

            const quantityCells = tbody.querySelectorAll('.quantity-cell');
            quantityCells.forEach(cell => {
              cell.addEventListener('click', function() {
                const currentValue = this.textContent;
                const ingredientId = this.dataset.ingredientId;
                this.innerHTML = `
                  <input type="number" class="border p-1 w-full rounded" value="${currentValue}" min="0">
                `;
                const input = this.querySelector('input');
                input.focus();
                input.addEventListener('blur', () => editIngredientQuantity(ingredientId, input.value));
                input.addEventListener('keypress', (e) => {
                  if (e.key === 'Enter') {
                    editIngredientQuantity(ingredientId, input.value);
                  }
                });
              });
            });

            const ordersBySupplier = {};
            sortedIngredients.forEach((ing) => {
              const ingData = ing.data();
              const minRequired = minIngredientRequirements[ing.id] || 0;
              const currentStock = ingData.stock_quantity_product || 0;
              if (minRequired > currentStock) {
                const toOrder = minRequired - currentStock;
                const supplier = ingData.supplier_product || 'Без поставщика';
                if (!ordersBySupplier[supplier]) {
                  ordersBySupplier[supplier] = [];
                }
                ordersBySupplier[supplier].push({
                  name: ingData.name_product,
                  quantity: toOrder,
                  price: ingData.current_price_product || 0,
                  weight: ingData.weight_product || 0
                });
              }
            });

            orderList.innerHTML = '<h2 class="text-xl font-bold mb-2">Список заказов</h2>';
            if (Object.keys(ordersBySupplier).length === 0) {
              orderList.innerHTML += '<p class="text-gray-500">Нет ингредиентов для заказа</p>';
              return;
            }

            for (const [supplier, items] of Object.entries(ordersBySupplier)) {
              let totalPrice = 0;
              let totalWeight = 0;
              let orderHtml = `<h3 class="text-lg font-semibold mt-4">Заказ ${supplier}</h3><ol class="list-decimal pl-6">`;
              items.forEach((item) => {
                const itemPrice = item.quantity * item.price;
                const itemWeight = item.quantity * item.weight;
                totalPrice += itemPrice;
                totalWeight += itemWeight;
                orderHtml += `<li>${item.name}: ${item.quantity} ($${itemPrice.toFixed(2)})</li>`;
              });
              orderHtml += `</ol>`;
              orderHtml += `<p class="mt-2">Сумма заказа: $${totalPrice.toFixed(2)}</p>`;
              orderHtml += `<p>Общий вес: ${totalWeight.toFixed(2)} кг</p>`;
              orderList.innerHTML += orderHtml;
            }
          })
          .catch((error) => {
            console.error('Ошибка загрузки блюд:', error);
            alert('Ошибка при загрузке блюд: ' + error.message);
          });
      })
      .catch((error) => {
        console.error('Ошибка загрузки инвентаря:', error);
        alert('Ошибка при загрузке инвентаря: ' + error.message);
      });
  }

  function editIngredientQuantity(ingredientId, newQuantity) {
    if (!firebaseApp) {
      alert('Firebase не инициализирован. Перезагрузите страницу.');
      return;
    }
    const quantity = parseInt(newQuantity) || 0;
    if (quantity < 0) {
      alert('Количество не может быть отрицательным.');
      return;
    }
    db.collection('ingredients').doc(ingredientId).update({
      stock_quantity_product: quantity
    })
      .then(() => {
        loadInventory();
        console.log(`Количество ингредиента ${ingredientId} обновлено: ${quantity}`);
      })
      .catch((error) => {
        console.error('Ошибка обновления количества ингредиента:', error);
        alert('Ошибка при обновлении количества: ' + error.message);
      });
  }

  function toggleAllIngredients() {
    showAllIngredients = !showAllIngredients;
    document.getElementById('toggle-all').textContent = showAllIngredients ? 'Скрыть неиспользуемые' : 'Показать все';
    loadInventory();
  }

  function loadIngredientForEdit(ingredientId) {
    if (!firebaseApp) {
      alert('Firebase не инициализирован. Перезагрузите страницу.');
      return;
    }
    const form = document.getElementById('ingredient-form');
    if (!form) {
      console.error('Форма с id="ingredient-form" не найдена в DOM');
      alert('Ошибка: Форма для редактирования ингредиента не найдена.');
      return;
    }

    db.collection('ingredients').doc(ingredientId).get()
      .then((ingredient) => {
        if (!ingredient.exists) {
          alert('Ингредиент не найден');
          return;
        }
        const ingData = ingredient.data();
        document.getElementById('ingredient-name').value = ingData.name_product || '';
        document.getElementById('ingredient-quantity').value = ingData.stock_quantity_product || 0;
        document.getElementById('ingredient-price').value = ingData.current_price_product || 0;
        document.getElementById('ingredient-supplier').value = ingData.supplier_product || '';
        document.getElementById('ingredient-weight').value = ingData.weight_product != null ? ingData.weight_product : '';
        form.dataset.ingredientId = ingredientId;
        document.getElementById('ingredient-form-button').textContent = 'Сохранить';
        form.classList.remove('hidden');
      })
      .catch((error) => {
        console.error('Ошибка загрузки ингредиента для редактирования:', error);
        alert('Ошибка при загрузке ингредиента: ' + error.message);
      });
  }

  function deleteIngredient(ingredientId) {
    if (!firebaseApp) {
      alert('Firebase не инициализирован. Перезагрузите страницу.');
      return;
    }
    db.collection('dishes').where('ingredients', 'array-contains', { ingredient_id: ingredientId }).get()
      .then((dishes) => {
        if (!dishes.empty) {
          alert('Нельзя удалить ингреди/deploy гредиент, так как он используется в блюдах.');
          return;
        }
        db.collection('ingredients').doc(ingredientId).delete()
          .then(() => {
            loadInventory();
            loadIngredientsSelect();
            alert('Ингредиент успешно удален!');
          })
          .catch((error) => {
            console.error('Ошибка удаления ингредиента:', error);
            alert('Ошибка при удалении ингредиента: ' + error.message);
          });
      })
      .catch((error) => {
        console.error('Ошибка проверки использования ингредиента:', error);
        alert('Ошибка при проверке ингредиента: ' + error.message);
      });
  }

  function loadIngredientsSelect() {
    if (!firebaseApp) {
      console.error('Firebase не инициализирован.');
      return;
    }
    const datalist = document.getElementById('ingredient-options');
    if (!datalist) {
      console.warn('Элемент с id="ingredient-options" не найден. Функция loadIngredientsSelect прервана.');
      return;
    }
    const searchInputs = document.querySelectorAll('input[id^="ingredient-search-"]:not([data-loaded])');
    if (!searchInputs.length) return;
    db.collection('ingredients').orderBy('name_product').get()
      .then((ingredients) => {
        datalist.innerHTML = '';
        if (ingredients.empty) {
          datalist.innerHTML += '<option value="" disabled>Ингредиенты отсутствуют</option>';
        } else {
          ingredients.forEach((ing) => {
            datalist.innerHTML += `<option value="${ing.data().name_product}" data-id="${ing.id}">${ing.data().name_product}</option>`;
          });
        }
        searchInputs.forEach((input) => {
          input.dataset.loaded = 'true';
          const currentValue = input.value;
          input.value = '';
          if (currentValue) {
            const matchingOption = Array.from(datalist.options).find(opt => opt.value === currentValue);
            if (matchingOption) {
              input.value = matchingOption.value;
              input.dataset.ingredientId = matchingOption.dataset.id;
            }
          }
          input.addEventListener('input', (e) => {
            const value = e.target.value.toLowerCase();
            const options = datalist.querySelectorAll('option');
            options.forEach((opt) => {
              const name = opt.value.toLowerCase();
              opt.style.display = name.startsWith(value) ? '' : 'none';
            });
          });
          input.addEventListener('change', (e) => {
            const selectedOption = Array.from(datalist.querySelectorAll('option')).find((opt) => opt.value === e.target.value);
            if (selectedOption) {
              e.target.dataset.ingredientId = selectedOption.dataset.id;
              e.target.value = selectedOption.value;
            } else {
              e.target.dataset.ingredientId = '';
            }
          });
        });
      })
      .catch((error) => {
        console.error('Ошибка загрузки ингредиентов:', error);
      });
  }

  function addIngredientRow() {
    const container = document.getElementById('ingredients-container');
    if (!container) {
      console.error('Контейнер с id="ingredients-container" не найден в DOM');
      return;
    }
    const rows = container.getElementsByClassName('ingredient-row');
    const index = rows.length;
    const row = document.createElement('div');
    row.className = 'ingredient-row flex flex-col md:flex-row gap-4';
    row.innerHTML = `
      <div class="flex-1">
        <label class="block mb-1">Ингредиент:</label>
        <input type="text" id="ingredient-search-${index}" class="border p-2 w-full rounded" placeholder="Введите название ингредиента" list="ingredient-options">
      </div>
      <div class="flex-1">
        <label class="block mb-1">Количество:</label>
        <input type="number" class="dish-ingredient-quantity border p-2 w-full rounded" placeholder="Количество" min="0" step="0.1">
      </div>
      <button onclick="removeIngredientRow(this)" class="bg-red-600 text-white rounded">🗑️</button>
    `;
    container.appendChild(row);
    loadIngredientsSelect();
  }

  function removeIngredientRow(button) {
    button.parentElement.remove();
  }

  function saveIngredient() {
    if (!firebaseApp) {
      alert('Firebase не инициализирован. Перезагрузите страницу.');
      return;
    }
    const form = document.getElementById('ingredient-form');
    if (!form) {
      console.error('Форма с id="ingredient-form" не найдена в DOM');
      alert('Ошибка: Форма для редактирования ингредиента не найдена.');
      return;
    }

    const name_product = document.getElementById('ingredient-name')?.value;
    const stock_quantity_product = document.getElementById('ingredient-quantity')?.value;
    const current_price_product = document.getElementById('ingredient-price')?.value;
    const supplier_product = document.getElementById('ingredient-supplier')?.value || '';
    const weight_product = document.g
etElementById('ingredient-weight')?.value;

    if (!name_product || !current_price_product) {
      alert('Пожалуйста, заполните обязательные поля: название и цену.');
      return;
    }

    const ingredientData = {
      name_product,
      stock_quantity_product: stock_quantity_product ? parseInt(stock_quantity_product) : 0,
      current_price_product: parseFloat(current_price_product),
      supplier_product,
      weight_product: weight_product ? parseFloat(weight_product) : 0
    };

    const ingredientId = form.dataset.ingredientId;
    if (ingredientId) {
      db.collection('ingredients').doc(ingredientId).update(ingredientData)
        .then(() => {
          loadInventory();
          loadIngredientsSelect();
          cancelIngredientForm();
          alert('Ингредиент успешно обновлен!');
        })
        .catch((error) => {
          console.error('Ошибка обновления ингредиента:', error);
          alert('Ошибка при обновлении ингредиента: ' + error.message);
        });
    } else {
      db.collection('ingredients').get()
        .then((ingredientsSnapshot) => {
          const existingIngredient = ingredientsSnapshot.docs.find(
            (doc) => doc.data().name_product.toLowerCase() === name_product.toLowerCase()
          );
          if (existingIngredient) {
            alert('Ингредиент с таким названием уже существует!');
            return;
          }
          db.collection('ingredients').add(ingredientData)
            .then((ingredientRef) => {
              db.collection('ingredients').doc(ingredientRef.id).update({ product_id: ingredientRef.id });
              loadInventory();
              loadIngredientsSelect();
              cancelIngredientForm();
              alert('Ингредиент успешно добавлен!');
            })
            .catch((error) => {
              console.error('Ошибка добавления ингредиента:', error);
              alert('Ошибка при добавлении ингредиента: ' + error.message);
            });
        })
        .catch((error) => {
          console.error('Ошибка проверки существования ингредиента:', error);
          alert('Ошибка при проверке ингредиента: ' + error.message);
        });
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
    } else {
      console.error('Форма с id="ingredient-form" не найдена в DOM');
    }
  }

  function cancelDishForm() {
    const form = document.getElementById('dish-form');
    if (form) {
      form.classList.add('hidden');
      form.dataset.dishId = '';
      document.getElementById('dish-name').value = '';
      document.getElementById('dish-price').value = '';
      document.getElementById('dish-category').value = '';
      document.getElementById('dish-active').checked = false;
      document.getElementById('dish-weight').value = '';
      document.getElementById('dish-min-portions').value = '';
      document.getElementById('dish-image').value = '';
      const container = document.getElementById('ingredients-container');
      if (container) {
        container.innerHTML = `
          <datalist id="ingredient-options"></datalist>
          <div class="ingredient-row flex flex-col md:flex-row gap-4">
            <div class="flex-1">
              <label class="block mb-1">Ингредиент:</label>
              <input type="text" id="ingredient-search-0" class="border p-2 w-full rounded" placeholder="Введите название ингредиента" list="ingredient-options">
            </div>
            <div class="flex-1">
              <label class="block mb-1">Количество:</label>
              <input type="number" class="dish-ingredient-quantity border p-2 w-full rounded" placeholder="Количество" min="0" step="0.1">
            </div>
          </div>
        `;
        loadIngredientsSelect();
      }
      document.getElementById('dish-form-button').onclick = addDish;
      document.getElementById('dish-form-button').textContent = 'Сохранить';
    } else {
      console.error('Форма с id="dish-form" не найдена в DOM');
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
      document.getElementById('category-form-button').textContent = 'Сохранить';
    } else {
      console.error('Форма с id="category-form" не найдена в DOM');
    }
  }

  function showDishForm() {
    const form = document.getElementById('dish-form');
    if (form) {
      form.classList.remove('hidden');
      loadIngredientsSelect();
    } else {
      console.error('Форма с id="dish-form" не найдена в DOM');
      alert('Ошибка: Форма для добавления блюда не найдена. Проверьте HTML.');
    }
  }

  function showCategoryForm() {
    const form = document.getElementById('category-form');
    if (form) {
      form.classList.remove('hidden');
    } else {
      console.error('Форма с id="category-form" не найдена в DOM');
      alert('Ошибка: Форма для добавления категории не найдена. Проверьте HTML.');
    }
  }

  function showIngredientForm() {
    const form = document.getElementById('ingredient-form');
    if (form) {
      cancelIngredientForm();
      form.classList.remove('hidden');
    } else {
      console.error('Форма с id="ingredient-form" не найдена в DOM');
      alert('Ошибка: Форма для добавления ингредиента не найдена. Проверьте HTML.');
    }
  }

  window.login = login;
  window.logout = logout;
  window.addDish = addDish;
  window.editDish = editDish;
  window.loadDishForEdit = loadDishForEdit;
  window.deleteDish = deleteDish;
  window.toggleDishVisibility = toggleDishVisibility;
  window.addCategory = addCategory;
  window.loadCategoryForEdit = loadCategoryForEdit;
  window.deleteCategory = deleteCategory;
  window.toggleCategoryVisibility = toggleCategoryVisibility;
  window.toggleCategoryFilter = toggleCategoryFilter;
  window.toggleShowAllDishes = toggleShowAllDishes;
  window.loadDishes = loadDishes;
  window.toggleDishDetails = toggleDishDetails;
  window.addIngredientRow = addIngredientRow;
  window.removeIngredientRow = removeIngredientRow;
  window.saveIngredient = saveIngredient;
  window.loadInventory = loadInventory;
  window.toggleAllIngredients = toggleAllIngredients;
  window.loadIngredientForEdit = loadIngredientForEdit;
  window.deleteIngredient = deleteIngredient;
  window.loadIngredientsSelect = loadIngredientsSelect;
  window.cancelDishForm = cancelDishForm;
  window.cancelCategoryForm = cancelCategoryForm;
  window.cancelIngredientForm = cancelIngredientForm;
  window.showDishForm = showDishForm;
  window.showCategoryForm = showCategoryForm;
  window.showIngredientForm = showIngredientForm;
  window.editIngredientQuantity = editIngredientQuantity;

  auth.onAuthStateChanged((user) => {
    console.log('Состояние авторизации:', user ? 'Авторизован' : 'Не авторизован');
    const navElement = document.getElementById('nav');
    if (navElement) {
      if (user) {
        navElement.classList.remove('hidden');
        loadNav();
      } else {
        navElement.classList.add('hidden');
        window.location.href = '/bar/index.html';
      }
    }
    if (document.getElementById('dishes-list')) loadDishes();
    if (document.getElementById('categories-list')) loadCategoryList();
    if (document.getElementById('dish-category')) loadCategories();
    if (document.getElementById('inventory-list')) loadInventory();
    if (document.getElementById('ingredients-container')) loadIngredientsSelect();
  });
}

document.addEventListener('DOMContentLoaded', function() {
  if (typeof window.initializeAppDone === 'undefined') {
    initializeApp();
    window.initializeAppDone = true;
  }
});
