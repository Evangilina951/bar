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
  const db = firebaseApp.firestore();
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
          const matchingOption = Array.from(dalist.options).find(opt => opt.value === currentValue);
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
    <button onclick="removeIngredientRow(this)" class="bg-red-600 text-white p-1 rounded mt-2 md:mt-0 md:ml-2">Удалить</button>
  `;
  container.appendChild(row);
  loadIngredientsSelect();
}

function removeIngredientRow(button) {
  button.parentElement.remove();
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

window.loadIngredientsSelect = loadIngredientsSelect;
window.addIngredientRow = addIngredientRow;
window.removeIngredientRow = removeIngredientRow;
window.cancelIngredientForm = cancelIngredientForm;
window.cancelDishForm = cancelDishForm;
window.cancelCategoryForm = cancelCategoryForm;
window.showDishForm = showDishForm;
window.showCategoryForm = showCategoryForm;
window.showIngredientForm = showIngredientForm;
