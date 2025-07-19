let firebaseApp = null;
let showAllDishes = false;

function initializeApp() {
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDK не загружен. Проверьте подключение скриптов.');
    return;
  }
  console.log('Firebase загружен успешно.');

  // Проверка, существует ли уже приложение Firebase
  if (!firebase.getApps().length) {
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
    firebaseApp = firebase.app(); // Используем существующее приложение
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
      <h2>Админ-панель</h2>
      <nav>
        <a href="/bar/index.html">Вход</a>
        <a href="/bar/menu.html">Меню</a>
        <a href="/bar/promocodes.html">Промокоды</a>
        <a href="/bar/dishes.html">Блюда</a>
        <a href="/bar/inventory.html">Инвентаризация</a>
        <a href="/bar/order-ingredients.html">Заказ ингредиентов</a>
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

  function calculateDishMetrics(ingredients) {
    if (!firebaseApp) {
      console.error('Firebase не инициализирован.');
      return { price_current_dish: 0 };
    }
    let price_current_dish = 0;
    if (!ingredients || ingredients.length === 0) {
      console.warn('Массив ingredients пустой или отсутствует');
      return { price_current_dish: 0 };
    }
    ingredients.forEach((ing) => {
      if (!ing.ingredient_id || !ing.quantity) {
        console.warn(`Некорректный ингредиент: ${JSON.stringify(ing)}`);
        return;
      }
      db.collection('ingredients').doc(ing.ingredient_id).get()
        .then((ingredient) => {
          if (ingredient.exists) {
            const ingData = ingredient.data();
            price_current_dish += ing.quantity * (ingData.current_price_product || 0);
          } else {
            console.warn(`Ингредиент ${ing.ingredient_id} не найден`);
          }
        })
        .catch((error) => {
          console.error('Ошибка получения ингредиента:', error);
        });
    });
    return { price_current_dish };
  }

  function loadMenu() {
    if (!firebaseApp) {
      console.error('Firebase не инициализирован.');
      return;
    }
    const categoriesDiv = document.getElementById('categories');
    if (!categoriesDiv) return;
    db.collection('categories').where('isVisible', '==', true).orderBy('number', 'asc').get()
      .then((categories) => {
        db.collection('dishes').where('is_active_dish', '==', true).get()
          .then((dishes) => {
            categoriesDiv.innerHTML = '';
            if (categories.empty) {
              categoriesDiv.innerHTML = '<p>Категории отсутствуют</p>';
              return;
            }
            categories.forEach((cat) => {
              const catDiv = document.createElement('div');
              catDiv.innerHTML = `<h2 class="text-xl">${cat.data().name}</h2>`;
              dishes.forEach((dish) => {
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
          })
          .catch((error) => {
            console.error('Ошибка загрузки меню:', error);
            alert('Ошибка при загрузке меню: ' + error.message);
          });
      })
      .catch((error) => {
        console.error('Ошибка загрузки категорий:', error);
        alert('Ошибка при загрузке категорий: ' + error.message);
      });
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
    orderItems.forEach((item) => {
      orderList.innerHTML += `<li>${item.name} - ${item.price} $</li>`;
    });
  }

  function placeOrder() {
    if (!firebaseApp) {
      alert('Firebase не инициализирован. Перезагрузите страницу.');
      return;
    }
    const comment = document.getElementById('order-comment')?.value || '';
    db.collection('orders').add({
      items: orderItems,
      comment,
      user: auth.currentUser?.uid || 'anonymous',
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    })
      .then(() => {
        orderItems = [];
        renderOrder();
        alert('Заказ оформлен!');
      })
      .catch((error) => {
        console.error('Ошибка оформления заказа:', error);
        alert('Ошибка при оформлении заказа: ' + error.message);
      });
  }

  function addDish() {
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
    const description_dish = document.getElementById('dish-description')?.value || '';
    const price_dish = parseFloat(document.getElementById('dish-price')?.value) || 0;
    const category_id = document.getElementById('dish-category')?.value;
    const image_dish = document.getElementById('dish-image')?.value || '';
    const is_active_dish = document.getElementById('dish-active')?.checked || false;
    const weight_dish = document.getElementById('dish-weight')?.value ? parseFloat(document.getElementById('dish-weight').value) : null;
    const min_dish = parseInt(document.getElementById('dish-min-portions')?.value) || 0;
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

    db.collection('categories').doc(category_id).get()
      .then((category) => {
        if (!category.exists) {
          alert('Выбранная категория не существует.');
          return;
        }
        const { price_current_dish } = calculateDishMetrics(ingredients);
        const salary_dish = Math.floor((price_dish - price_current_dish) * SALARY_RATE * 10) / 10;
        const price_profit_dish = Math.floor((price_dish - price_current_dish - salary_dish) * 10) / 10;

        db.collection('dishes').add({
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
        })
          .then((dishRef) => {
            db.collection('dishes').doc(dishRef.id).update({ dish_id: dishRef.id });
            loadDishes();
            cancelDishForm();
            alert('Блюдо успешно добавлено!');
          })
          .catch((error) => {
            console.error('Ошибка добавления блюда:', error);
            alert('Ошибка при добавлении блюда: ' + error.message);
          });
      })
      .catch((error) => {
        console.error('Ошибка проверки категории:', error);
        alert('Ошибка при проверке категории: ' + error.message);
      });
  }

  function loadDishes() {
    if (!firebaseApp) {
      console.error('Firebase не инициализирован.');
      return;
    }
    const list = document.getElementById('dishes-list');
    if (!list) return;
    const filterCategory = showAllDishes ? null : currentCategoryFilter || document.getElementById('filter-category')?.value;
    const dishesQuery = filterCategory ? db.collection('dishes').where('category_id', '==', filterCategory) : db.collection('dishes');
    dishesQuery.get()
      .then((dishes) => {
        db.collection('categories').get()
          .then((categories) => {
            const categoryMap = {};
            categories.forEach((cat) => categoryMap[cat.id] = cat.data().name);
            list.innerHTML = '';
            if (dishes.empty) {
              list.innerHTML = '<p class="text-gray-500">Блюда отсутствуют</p>';
              return;
            }
            dishes.forEach((dish) => {
              const dishData = dish.data();
              const ingredients = dishData.ingredients || [];
              let ingredientNames = [];
              ingredients.forEach((ing) => {
                db.collection('ingredients').doc(ing.ingredient_id).get()
                  .then((ingredient) => {
                    ingredientNames.push(ingredient.exists ? `${ingredient.data().name_product} (${ing.quantity})` : `Неизвестный ингредиент (${ing.quantity})`);
                    if (ingredientNames.length === ingredients.length) {
                      renderDishCard(dish, ingredientNames, categoryMap);
                    }
                  })
                  .catch((error) => {
                    console.error('Ошибка загрузки ингредиента:', error);
                  });
              });
              if (ingredients.length === 0) {
                renderDishCard(dish, ingredientNames, categoryMap);
              }
            });
          })
          .catch((error) => {
            console.error('Ошибка загрузки категорий:', error);
          });
      })
      .catch((error) => {
        console.error('Ошибка загрузки блюд:', error);
        alert('Ошибка при загрузке блюд: ' + error.message);
      });
  }

  function renderDishCard(dish, ingredientNames, categoryMap) {
    const list = document.getElementById('dishes-list');
    const dishCard = document.createElement('div');
    dishCard.className = 'dish-card';
    dishCard.innerHTML = `
      <div class="flex flex-col h-full">
        ${dish.data().image_dish ? `<img src="${dish.data().image_dish}" alt="${dish.data().name_dish}" class="dish-image">` : '<div class="dish-image bg-gray-200"></div>'}
        <p class="font-bold">${dish.data().name_dish} - ${dish.data().price_dish} $</p>
        <p class="text-sm text-gray-600">Категория: ${categoryMap[dish.data().category_id] || 'Нет'}</p>
        <button onclick="toggleDishDetails(this)" class="bg-gray-600 text-white p-1 rounded mt-2">Развернуть</button>
        <div class="dish-details">
          <p class="text-sm text-gray-600">Себестоимость: ${Math.floor(dish.data().price_current_dish * 10) / 10} $</p>
          <p class="text-sm text-gray-600">Зарплата: ${Math.floor(dish.data().salary_dish * 10) / 10} $</p>
          <p class="text-sm text-gray-600">Прибыль: ${Math.floor(dish.data().price_profit_dish * 10) / 10} $</p>
          <p class="text-sm text-gray-600">Описание: ${dish.data().description_dish || 'Нет'}</p>
          <p class="text-sm text-gray-600">Вес: ${dish.data().weight_dish != null ? dish.data().weight_dish : 0} г</p>
          <p class="text-sm text-gray-600">Мин. порций: ${dish.data().min_dish || 0}</p>
          <p class="text-sm text-gray-600">Ингредиенты: ${ingredientNames.join(', ') || 'Нет'}</p>
          <div class="flex gap-2 mt-2">
            <button onclick="loadDishForEdit('${dish.id}')" class="edit-btn text-white p-2 rounded flex-1">✏️</button>
            <button onclick="deleteDish('${dish.id}')" class="delete-btn text-white p-2 rounded flex-1">🗑️</button>
            <button onclick="toggleDishVisibility('${dish.id}', ${!dish.data().is_active_dish})" class="${dish.data().is_active_dish ? 'toggle-active-btn' : 'toggle-inactive-btn'} text-white p-2 rounded flex-1">${dish.data().is_active_dish ? '✔️' : '❌'}</button>
          </div>
        </div>
      </div>`;
    list.appendChild(dishCard);
  }

  function toggleDishDetails(button) {
    const details = button.nextElementSibling;
    if (details.style.display === 'none' || details.style.display === '') {
      details.style.display = 'block';
      button.textContent = 'Скрыть';
    } else {
      details.style.display = 'none';
      button.textContent = 'Развернуть';
    }
  }

  function loadDishForEdit(dishId) {
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

    db.collection('dishes').doc(dishId).get()
      .then((dish) => {
        if (!dish.exists) {
          alert('Блюдо не найдено');
          return;
        }
        const dishData = dish.data();
        document.getElementById('dish-name').value = dishData.name_dish || '';
        document.getElementById('dish-description').value = dishData.description_dish || '';
        document.getElementById('dish-price').value = dishData.price_dish || 0;
        document.getElementById('dish-category').value = dishData.category_id || '';
        document.getElementById('dish-image').value = dishData.image_dish || '';
        document.getElementById('dish-weight').value = dishData.weight_dish != null ? dishData.weight_dish : '';
        document.getElementById('dish-min-portions').value = dishData.min_dish || 0;
        document.getElementById('dish-active').checked = dishData.is_active_dish || false;
        const container = document.getElementById('ingredients-container');
        if (container) {
          container.innerHTML = '<datalist id="ingredient-options"></datalist>';
          (dishData.ingredients || []).forEach((ing, index) => {
            db.collection('ingredients').doc(ing.ingredient_id).get()
              .then((ingredient) => {
                const name = ingredient.exists ? ingredient.data().name_product : 'Неизвестный ингредиент';
                container.innerHTML += `
                  <div class="ingredient-row">
                    <input type="text" id="ingredient-search-${index}" class="border p-2 mr-2 w-2/3 rounded" placeholder="Введите название ингредиента" list="ingredient-options" value="${name}" data-ingredient-id="${ing.ingredient_id || ''}">
                    <input type="number" class="dish-ingredient-quantity border p-2 w-1/3 rounded" placeholder="Количество" min="0" step="0.1" value="${ing.quantity || 0}">
                    <button onclick="removeIngredientRow(this)" class="bg-red-600 text-white p-1 rounded ml-2">Удалить</button>
                  </div>
                `;
                if (index === dishData.ingredients.length - 1) loadIngredientsSelect();
              })
              .catch((error) => {
                console.error('Ошибка загрузки ингредиента:', error);
              });
          });
          if (!dishData.ingredients || dishData.ingredients.length === 0) {
            container.innerHTML = `
              <datalist id="ingredient-options"></datalist>
              <div class="ingredient-row">
                <input type="text" id="ingredient-search-0" class="border p-2 mr-2 w-2/3 rounded" placeholder="Введите название ингредиента" list="ingredient-options">
                <input type="number" class="dish-ingredient-quantity border p-2 w-1/3 rounded" placeholder="Количество" min="0" step="0.1">
                <button onclick="removeIngredientRow(this)" class="bg-red-600 text-white p-1 rounded ml-2">Удалить</button>
              </div>
            `;
            loadIngredientsSelect();
          }
        }
        form.dataset.dishId = dishId;
        document.getElementById('dish-form-button').onclick = editDish;
        document.getElementById('dish-form-button').textContent = 'Сохранить изменения';
        form.classList.remove('hidden');
      })
      .catch((error) => {
        console.error('Ошибка загрузки блюда для редактирования:', error);
        alert('Ошибка при загрузке блюда: ' + error.message);
      });
  }

  function editDish() {
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
    const description_dish = document.getElementById('dish-description')?.value || '';
    const price_dish = parseFloat(document.getElementById('dish-price')?.value) || 0;
    const category_id = document.getElementById('dish-category')?.value;
    const image_dish = document.getElementById('dish-image')?.value || '';
    const is_active_dish = document.getElementById('dish-active')?.checked || false;
    const weight_dish = document.getElementById('dish-weight')?.value ? parseFloat(document.getElementById('dish-weight').value) : null;
    const min_dish = parseInt(document.getElementById('dish-min-portions')?.value) || 0;
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

    db.collection('categories').doc(category_id).get()
      .then((category) => {
        if (!category.exists) {
          alert('Выбранная категория не существует.');
          return;
        }
        const { price_current_dish } = calculateDishMetrics(ingredients);
        const salary_dish = Math.floor((price_dish - price_current_dish) * SALARY_RATE * 10) / 10;
        const price_profit_dish = Math.floor((price_dish - price_current_dish - salary_dish) * 10) / 10;

        db.collection('dishes').doc(dishId).update({
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
        })
          .then(() => {
            loadDishes();
            cancelDishForm();
            alert('Блюдо успешно обновлено!');
          })
          .catch((error) => {
            console.error('Ошибка обновления блюда:', error);
            alert('Ошибка при обновлении блюда: ' + error.message);
          });
      })
      .catch((error) => {
        console.error('Ошибка проверки категории:', error);
        alert('Ошибка при проверке категории: ' + error.message);
      });
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
        alert('Ошибка при удалении блюда: ' + error.message);
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

  function addCategory() {
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
    if (categoryId) {
      db.collection('categories').doc(categoryId).update({ name, isVisible, number })
        .then(() => {
          loadCategories();
          loadCategoryList();
          cancelCategoryForm();
          alert('Категория успешно обновлена!');
        })
        .catch((error) => {
          console.error('Ошибка обновления категории:', error);
          alert('Ошибка при обновлении категории: ' + error.message);
        });
    } else {
      db.collection('categories').add({ name, isVisible, number })
        .then(() => {
          loadCategories();
          loadCategoryList();
          cancelCategoryForm();
          alert('Категория успешно добавлена!');
        })
        .catch((error) => {
          console.error('Ошибка добавления категории:', error);
          alert('Ошибка при добавлении категории: ' + error.message);
        });
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
        select.innerHTML = '<option value="">Выберите категорию</option>';
        categories.forEach((cat) => {
          select.innerHTML += `<option value="${cat.id}">${cat.data().name}</option>`;
        });
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
              <span class="cursor-pointer" onclick="toggleCategoryFilter('${cat.id}', '${catData.name}')">${catData.name} (Порядок: ${catData.number}, Видимость: ${catData.isVisible ? 'Вкл' : 'Выкл'})</span>
              <div class="flex gap-2">
                <button onclick="loadCategoryForEdit('${cat.id}')" class="edit-btn text-white p-2 rounded flex-1">✏️</button>
                <button onclick="deleteCategory('${cat.id}')" class="delete-btn text-white p-2 rounded flex-1">🗑️</button>
                <button onclick="toggleCategoryVisibility('${cat.id}', ${!catData.isVisible})" class="${catData.isVisible ? 'toggle-active-btn' : 'toggle-inactive-btn'} text-white p-2 rounded flex-1">${catData.isVisible ? '✔️' : '❌'}</button>
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
        document.getElementById('category-form-button').textContent = 'Сохранить изменения';
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
    if (!list) return;
    db.collection('ingredients').get()
      .then((ingredients) => {
        db.collection('dishes').get()
          .then((dishes) => {
            const usedIngredientIds = new Set();
            dishes.forEach((dish) => {
              const dishData = dish.data();
              if (dishData.ingredients) {
                dishData.ingredients.forEach((ing) => usedIngredientIds.add(ing.ingredient_id));
              }
            });

            list.innerHTML = `
              <table>
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Количество</th>
                    <th>Цена ($)</th>
                    <th>Вес (кг)</th>
                    <th>Поставщик</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                </tbody>
              </table>
            `;
            const tbody = list.querySelector('tbody');
            if (ingredients.empty) {
              tbody.innerHTML = '<tr><td colspan="6">Ингредиенты отсутствуют</td></tr>';
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
                <td>${ingData.name_product || 'Без названия'}</td>
                <td>${ingData.stock_quantity_product || 0}</td>
                <td>${ingData.current_price_product || 0}</td>
                <td>${ingData.weight_product != null ? ingData.weight_product : 0}</td>
                <td>${ingData.supplier_product || 'Нет'}</td>
                <td>
                  <button onclick="loadIngredientForEdit('${ing.id}')" class="bg-yellow-600 text-white p-1 rounded">Редактировать</button>
                  <button onclick="deleteIngredient('${ing.id}')" class="bg-red-600 text-white p-1 rounded ml-2">Удалить</button>
                </td>
              `;
              tbody.appendChild(row);
            });
          })
          .catch((error) => {
            console.error('Ошибка загрузки блюд:', error);
          });
      })
      .catch((error) => {
        console.error('Ошибка загрузки инвентаря:', error);
        alert('Ошибка при загрузке инвентаря: ' + error.message);
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
        document.getElementById('ingredient-form-button').textContent = 'Сохранить изменения';
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
          alert('Нельзя удалить ингредиент, так как он используется в блюдах.');
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
    row.className = 'ingredient-row';
    row.innerHTML = `
      <input type="text" id="ingredient-search-${index}" class="border p-2 mr-2 w-2/3 rounded" placeholder="Введите название ингредиента" list="ingredient-options">
      <input type="number" class="dish-ingredient-quantity border p-2 w-1/3 rounded" placeholder="Количество" min="0" step="0.1">
      <button onclick="removeIngredientRow(this)" class="bg-red-600 text-white p-1 rounded ml-2">Удалить</button>
    `;
    container.appendChild(row);
    loadIngredientsSelect();
  }

  function removeIngredientRow(button) {
    button.parentElement.remove();
  }

  function addIngredient(name_product, stock_quantity_product, current_price_product, supplier_product, weight_product) {
    if (!firebaseApp) {
      alert('Firebase не инициализирован. Перезагрузите страницу.');
      return;
    }
    if (!name_product || !current_price_product) {
      alert('Пожалуйста, заполните обязательные поля: название и цену.');
      return;
    }
    const form = document.getElementById('ingredient-form');
    const ingredientId = form ? form.dataset.ingredientId : null;
    const ingredientData = {
      name_product,
      stock_quantity_product: stock_quantity_product >= 0 ? parseInt(stock_quantity_product) : 0,
      current_price_product: parseFloat(current_price_product),
      supplier_product: supplier_product || '',
      weight_product: weight_product != null && weight_product >= 0 ? parseFloat(weight_product) : 0
    };

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
          const existingIngredient = ingredientsSnapshot.docs.find((doc) => doc.data().name_product.toLowerCase() === name_product.toLowerCase());
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
      document.getElementById('dish-description').value = '';
      document.getElementById('dish-price').value = '';
      document.getElementById('dish-category').value = '';
      document.getElementById('dish-image').value = '';
      document.getElementById('dish-active').checked = false;
      document.getElementById('dish-weight').value = '';
      document.getElementById('dish-min-portions').value = '';
      const container = document.getElementById('ingredients-container');
      if (container) {
        container.innerHTML = `
          <datalist id="ingredient-options"></datalist>
          <div class="ingredient-row">
            <input type="text" id="ingredient-search-0" class="border p-2 mr-2 w-2/3 rounded" placeholder="Введите название ингредиента" list="ingredient-options">
            <input type="number" class="dish-ingredient-quantity border p-2 w-1/3 rounded" placeholder="Количество" min="0" step="0.1">
            <button onclick="removeIngredientRow(this)" class="bg-red-600 text-white p-1 rounded ml-2">Удалить</button>
          </div>
        `;
        loadIngredientsSelect();
      }
      document.getElementById('dish-form-button').onclick = addDish;
      document.getElementById('dish-form-button').textContent = 'Добавить блюдо';
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
      document.getElementById('category-form-button').textContent = 'Добавить категорию';
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
      form.classList.remove('hidden');
      loadIngredientsSelect();
    } else {
      console.error('Форма с id="ingredient-form" не найдена в DOM');
      alert('Ошибка: Форма для добавления ингредиента не найдена. Проверьте HTML.');
    }
  }

  window.login = login;
  window.logout = logout;
  window.addToOrder = addToOrder;
  window.placeOrder = placeOrder;
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
  window.addIngredient = addIngredient;
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

  auth.onAuthStateChanged((user) => {
    console.log('Состояние авторизации:', user ? 'Авторизован' : 'Не авторизован');
    loadNav();
    if (document.getElementById('categories')) loadMenu();
    if (document.getElementById('dishes-list')) loadDishes();
    if (document.getElementById('categories-list')) loadCategoryList();
    if (document.getElementById('dish-category')) loadCategories();
    if (document.getElementById('inventory-list')) loadInventory();
    if (document.getElementById('ingredients-container')) loadIngredientsSelect();
  });
}

document.addEventListener('DOMContentLoaded', initializeApp);
