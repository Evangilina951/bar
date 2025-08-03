let showAllDishes = false;
let searchQuery = '';
const SALARY_RATE = 0.4;
let currentCategoryFilter = null;

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
  const db = firebaseApp.firestore();
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

  const db = firebaseApp.firestore();
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
  const db = firebaseApp.firestore();
  let dishesQuery = db.collection('dishes');
  if (!showAllDishes && currentCategoryFilter) {
    dishesQuery = dishesQuery.where('category_id', '==', currentCategoryFilter);
  }
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
    let dishDataArray = await Promise.all(dishPromises);
    if (searchQuery) {
      dishDataArray = dishDataArray.filter(({ dish }) => 
        dish.data().name_dish.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    list.innerHTML = '';
    if (dishDataArray.length === 0) {
      list.innerHTML = '<p class="text-gray-500">Блюда не найдены</p>';
      return;
    }
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
      <div class="dish-details" style="display: none;">
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
  if (details.style.display === 'none' || details.style.display === '') {
    details.style.display = 'block';
    button.textContent = 'Скрыть';
  } else {
    details.style.display = 'none';
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
    const db = firebaseApp.firestore();
    const dish = await db.collection('dishes').doc(dishId).get();
    if (!dish.exists) {
      alert('Блюдо не найдено');
      return;
    }
    const dishData = dish.data();

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

    form.classList.remove('hidden');

    elements['dish-name'].value = dishData.name_dish || '';
    elements['dish-price'].value = dishData.price_dish || 0;
    elements['dish-category'].value = dishData.category_id || '';
    elements['dish-weight'].value = dishData.weight_dish != null ? dishData.weight_dish : '';
    elements['dish-min-portions'].value = dishData.min_dish || 0;
    elements['dish-active'].checked = dishData.is_active_dish || false;
    elements['dish-image'].value = dishData.image_dish || '';

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
              ${index > 0 ? `<button onclick="removeIngredientRow(this)" class="bg-red-600 text-white p-1 rounded mt-2 md:mt-0 md:ml-2">Удалить</button>` : ''}
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

  const db = firebaseApp.firestore();
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
  const db = firebaseApp.firestore();
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
  const db = firebaseApp.firestore();
  db.collection('dishes').doc(dishId).update({ is_active_dish: isActive })
    .then(() => {
      loadDishes();
    })
    .catch((error) => {
      console.error('Ошибка изменения видимости блюда:', error);
      alert('Ошибка при изменении видимости блюда: ' + error.message);
    });
}

function toggleShowAllDishes() {
  showAllDishes = true;
  currentCategoryFilter = null;
  searchQuery = '';
  const searchInput = document.getElementById('dish-search');
  if (searchInput) {
    searchInput.value = '';
  }
  loadDishes();
}

window.addDish = addDish;
window.loadDishes = loadDishes;
window.renderDishCard = renderDishCard;
window.toggleDishDetails = toggleDishDetails;
window.loadDishForEdit = loadDishForEdit;
window.editDish = editDish;
window.deleteDish = deleteDish;
window.toggleDishVisibility = toggleDishVisibility;
window.toggleShowAllDishes = toggleShowAllDishes;
