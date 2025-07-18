async function loadIngredientsSelect() {
  const selects = document.querySelectorAll('.dish-ingredient:not([data-loaded])');
  if (!selects.length) return;
  try {
    const ingredients = await firebase.firestore().collection('ingredients').get();
    selects.forEach(select => {
      const currentValue = select.value;
      select.innerHTML = '<option value="">Выберите ингредиент</option>';
      if (ingredients.empty) {
        select.innerHTML += '<option value="" disabled>Ингредиенты отсутствуют</option>';
      } else {
        ingredients.forEach(ing => {
          select.innerHTML += `<option value="${ing.id}">${ing.data().name_product}</option>`;
        });
      }
      select.value = currentValue;
      select.dataset.loaded = 'true';
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
  const newSelect = row.querySelector('.dish-ingredient');
  loadIngredientsSelectForRow(newSelect);
}

async function loadIngredientsSelectForRow(select) {
  try {
    const ingredients = await firebase.firestore().collection('ingredients').get();
    select.innerHTML = '<option value="">Выберите ингредиент</option>';
    if (ingredients.empty) {
      select.innerHTML += '<option value="" disabled>Ингредиенты отсутствуют</option>';
    } else {
      ingredients.forEach(ing => {
        select.innerHTML += `<option value="${ing.id}">${ing.data().name_product}</option>`;
      });
    }
    select.dataset.loaded = 'true';
  } catch (error) {
    console.error('Ошибка загрузки ингредиентов для строки:', error);
  }
}

async function addIngredient(name_product, stock_quantity_product, current_price_product, supplier_product, weight_product) {
  if (!name_product || !current_price_product) {
    alert('Пожалуйста, заполните обязательные поля: название и цену.');
    return;
  }
  try {
    const ingredientsSnapshot = await firebase.firestore().collection('ingredients').get();
    const existingIngredient = ingredientsSnapshot.docs.find(doc => doc.data().name_product.toLowerCase() === name_product.toLowerCase());
    if (existingIngredient) {
      alert('Ингредиент с таким названием уже существует!');
      return;
    }

    const ingredientRef = await firebase.firestore().collection('ingredients').add({
      name_product,
      stock_quantity_product: stock_quantity_product >= 0 ? stock_quantity_product : 0,
      current_price_product,
      supplier_product: supplier_product || '',
      weight_product: weight_product >= 0 ? weight_product : 0
    });
    await firebase.firestore().collection('ingredients').doc(ingredientRef.id).update({ product_id: ingredientRef.id });
    loadInventory();
    loadIngredientsSelect();
    loadOrderIngredients();
    hideIngredientForm();
    document.getElementById('ingredient-form').reset();
    alert('Ингредиент успешно добавлен!');
  } catch (error) {
    console.error('Ошибка добавления ингредиента:', error);
    alert('Ошибка при добавлении ингредиента: ' + error.message);
  }
}

async function editIngredient(ingredientId) {
  const name_product = document.getElementById('ingredient-name')?.value;
  const stock_quantity_product = parseInt(document.getElementById('ingredient-quantity')?.value) || 0;
  const current_price_product = parseFloat(document.getElementById('ingredient-price')?.value);
  const supplier_product = document.getElementById('ingredient-supplier')?.value || '';
  const weight_product = parseFloat(document.getElementById('ingredient-weight')?.value) || 0;
  if (!name_product || !current_price_product) {
    alert('Пожалуйста, заполните обязательные поля: название и цену.');
    return;
  }
  try {
    await firebase.firestore().collection('ingredients').doc(ingredientId).update({
      name_product,
      stock_quantity_product: stock_quantity_product >= 0 ? stock_quantity_product : 0,
      current_price_product,
      supplier_product,
      weight_product: weight_product >= 0 ? weight_product : 0
    });
    loadInventory();
    loadIngredientsSelect();
    loadOrderIngredients();
    hideIngredientForm();
    document.getElementById('ingredient-form').reset();
    document.getElementById('ingredient-form').dataset.ingredientId = '';
    document.getElementById('ingredient-form-button').textContent = 'Сохранить';
    alert('Ингредиент успешно обновлен!');
  } catch (error) {
    console.error('Ошибка обновления ингредиента:', error);
    alert('Ошибка при обновлении ингредиента: ' + error.message);
  }
}

async function loadIngredientForEdit(ingredientId) {
  try {
    if (!firebase.auth().currentUser) {
      console.error('Пользователь не авторизован');
      alert('Пожалуйста, войдите в систему.');
      return;
    }
    console.log('Загрузка ингредиента для редактирования, ID:', ingredientId);
    const ingredient = await firebase.firestore().collection('ingredients').doc(ingredientId).get();
    if (!ingredient.exists) {
      console.error('Ингредиент с ID', ingredientId, 'не найден');
      alert('Ингредиент не найден');
      return;
    }
    const ingData = ingredient.data();
    console.log('Данные ингредиента:', ingData);

    const form = document.getElementById('ingredient-form');
    if (!form) {
      console.error('Форма с id="ingredient-form" не найдена');
      alert('Форма редактирования не найдена. Обновите страницу.');
      return;
    }

    showIngredientForm();
    console.log('Форма показана, состояние:', { display: form.style.display, visibility: form.style.visibility });

    const nameField = document.getElementById('ingredient-name');
    const quantityField = document.getElementById('ingredient-quantity');
    const priceField = document.getElementById('ingredient-price');
    const supplierField = document.getElementById('ingredient-supplier');
    const weightField = document.getElementById('ingredient-weight');

    if (!nameField || !quantityField || !priceField || !supplierField || !weightField) {
      console.error('Один или несколько полей формы не найдены:', { nameField, quantityField, priceField, supplierField, weightField });
      alert('Ошибка: Некоторые поля формы отсутствуют. Обновите страницу.');
      return;
    }

    nameField.value = ingData.name_product || '';
    console.log('Установлено name_product:', nameField.value);
    quantityField.value = ingData.stock_quantity_product || 0;
    console.log('Установлено stock_quantity_product:', quantityField.value);
    priceField.value = ingData.current_price_product || 0;
    console.log('Установлено current_price_product:', priceField.value);
    supplierField.value = ingData.supplier_product || '';
    console.log('Установлено supplier_product:', supplierField.value);
    weightField.value = ingData.weight_product || 0;
    console.log('Установлено weight_product:', weightField.value);

    document.getElementById('ingredient-form').dataset.ingredientId = ingredientId;
    document.getElementById('ingredient-form-button').textContent = 'Сохранить';
    console.log('Форма заполнена данными:', ingData);
    console.log('Состояние формы после заполнения:', {
      display: form.style.display,
      visibility: form.style.visibility
    });

    setTimeout(() => {
      console.log('Проверка значений после задержки:', {
        name: nameField.value,
        quantity: quantityField.value,
        price: priceField.value,
        supplier: supplierField.value,
        weight: weightField.value
      });
    }, 100);
  } catch (error) {
    console.error('Ошибка загрузки ингредиента для редактирования:', error);
    alert('Ошибка при загрузке ингредиента: ' + error.message);
  }
}

async function deleteIngredient(ingredientId) {
  try {
    await firebase.firestore().collection('ingredients').doc(ingredientId).delete();
    loadInventory();
    loadIngredientsSelect();
    loadOrderIngredients();
    alert('Ингредиент успешно удален!');
  } catch (error) {
    console.error('Ошибка удаления ингредиента:', error);
    alert('Ошибка при удалении ингредиента: ' + error.message);
  }
}

async function updateIngredientQuantity(ingredientId, newQuantity) {
  try {
    const parsedQuantity = parseInt(newQuantity) || 0;
    await firebase.firestore().collection('ingredients').doc(ingredientId).update({
      stock_quantity_product: parsedQuantity >= 0 ? parsedQuantity : 0
    });
    loadInventory();
    loadOrderIngredients();
  } catch (error) {
    console.error('Ошибка обновления количества ингредиента:', error);
    alert('Ошибка при обновлении количества: ' + error.message);
  }
}

async function loadInventory() {
  if (!document.getElementById('inventory-list')) return;
  try {
    console.log('Загрузка инвентаря началась...');
    const ingredients = await firebase.firestore().collection('ingredients').get();
    const dishes = await firebase.firestore().collection('dishes').get();
    const usedIngredientIds = new Set();
    dishes.forEach(dish => {
      const dishData = dish.data();
      if (dishData.ingredients) {
        dishData.ingredients.forEach(ing => usedIngredientIds.add(ing.ingredient_id));
      }
    });

    console.log('Получено ингредиентов:', ingredients.size);
    const list = document.getElementById('inventory-list');
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
      console.log('Ингредиенты отсутствуют в базе данных.');
      tbody.innerHTML = '<tr><td colspan="6" class="border border-gray-300 p-2 text-center">Ингредиенты отсутствуют</td></tr>';
      return;
    }

    let showUnused = document.getElementById('toggle-unused').dataset.show === 'true';
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
        <td class="border border-gray-300 p-2">${ingData.weight_product || 0}</td>
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

function showIngredientForm() {
  const form = document.getElementById('ingredient-form');
  if (form) {
    form.style.display = 'block';
    form.style.visibility = 'visible';
  } else {
    console.warn('Форма с id="ingredient-form" не найдена при вызове showIngredientForm.');
  }
}

function hideIngredientForm() {
  const form = document.getElementById('ingredient-form');
  if (form) {
    form.style.display = 'none';
    form.dataset.ingredientId = '';
    document.getElementById('ingredient-form-button').textContent = 'Сохранить';
    form.reset();
  } else {
    console.warn('Форма с id="ingredient-form" не найдена при вызове hideIngredientForm.');
  }
}

function toggleUnusedIngredients() {
  const button = document.getElementById('toggle-unused');
  const showUnused = button.dataset.show === 'true';
  button.dataset.show = !showUnused;
  button.textContent = !showUnused ? 'Скрыть неиспользуемые' : 'Показать все';
  loadInventory();
}

function editQuantity(ingredientId, currentValue) {
  const td = document.querySelector(`td[onclick="editQuantity('${ingredientId}', ${currentValue})"]`);
  const span = td.querySelector('.quantity-display');
  const input = td.querySelector('.quantity-input');
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
