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
    const ingredient = await firebase.firestore().collection('ingredients').doc(ing.ingredient_id).get();
    if (ingredient.exists) {
      const ingData = ingredient.data();
      price_current_dish += ing.quantity * ingData.current_price_product;
    } else {
      console.warn(`Ингредиент ${ing.ingredient_id} не найден`);
    }
  }
  return { price_current_dish };
}

async function loadMenu() {
  if (!document.getElementById('categories')) return;
  try {
    const categories = await firebase.firestore().collection('categories').where('isVisible', '==', true).orderBy('number', 'asc').get();
    const dishes = await firebase.firestore().collection('dishes').where('is_active_dish', '==', true).get();
    const categoriesDiv = document.getElementById('categories');
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
                <p>${dishData.description_dish}</p>
                <p>Вес: ${dishData.weight_dish} кг</p>
                <p>Мин. порций: ${dishData.min_dish}</p>
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
  if (orderItems.length === 0) {
    orderList.innerHTML = '<li>Заказ пуст</li>';
    return;
  }
  orderItems.forEach(item => {
    orderList.innerHTML += `<li>${item.name} - ${item.price} $</li>`;
  });
}

async function placeOrder() {
  const comment = document.getElementById('order-comment')?.value;
  try {
    await firebase.firestore().collection('orders').add({
      items: orderItems,
      comment,
      user: firebase.auth().currentUser.uid,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    for (const item of orderItems) {
      const dish = await firebase.firestore().collection('dishes').doc(item.dishId).get();
      const ingredients = dish.data().ingredients || [];
      for (const ing of ingredients) {
        const ingredientRef = firebase.firestore().collection('ingredients').doc(ing.ingredient_id);
        const ingredient = await ingredientRef.get();
        await ingredientRef.update({
          stock_quantity_product: ingredient.data().stock_quantity_product - ing.quantity
        });
      }
    }
    orderItems = [];
    renderOrder();
    alert('Заказ оформлен!');
    loadOrderIngredients();
  } catch (error) {
    console.error('Ошибка оформления заказа:', error);
    alert('Ошибка при оформлении заказа: ' + error.message);
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
  const min_dish = parseInt(document.getElementById('dish-min-portions')?.value) || 0;
  const ingredientRows = document.querySelectorAll('.ingredient-row');
  const ingredients = Array.from(ingredientRows).map(row => ({
    ingredient_id: row.querySelector('.dish-ingredient').value,
    quantity: parseInt(row.querySelector('.dish-ingredient-quantity').value) || 0
  })).filter(ing => ing.ingredient_id && ing.quantity > 0);

  if (!name_dish || !price_dish || !category_id || !weight_dish || ingredients.length === 0 || !min_dish) {
    alert('Пожалуйста, заполните все обязательные поля и добавьте хотя бы один ингредиент.');
    return;
  }

  try {
    const category = await firebase.firestore().collection('categories').doc(category_id).get();
    if (!category.exists) {
      alert('Выбранная категория не существует.');
      return;
    }

    const { price_current_dish } = await calculateDishMetrics(ingredients);
    if (price_current_dish === 0) {
      alert('Ошибка: Не удалось рассчитать себестоимость.');
      return;
    }
    const salary_dish = (price_dish - price_current_dish) * SALARY_RATE;
    const price_profit_dish = price_dish - price_current_dish - salary_dish;

    const dishRef = await firebase.firestore().collection('dishes').add({
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

    await firebase.firestore().collection('dishes').doc(dishRef.id).update({ dish_id: dishRef.id });
    loadDishes();
    document.getElementById('dish-form').reset();
    document.querySelectorAll('.ingredient-row:not(:first-child)').forEach(row => row.remove());
    loadIngredientsSelect();
    loadOrderIngredients();
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
  const min_dish = parseInt(document.getElementById('dish-min-portions')?.value) || 0;
  const ingredientRows = document.querySelectorAll('.ingredient-row');
  const ingredients = Array.from(ingredientRows).map(row => ({
    ingredient_id: row.querySelector('.dish-ingredient').value,
    quantity: parseInt(row.querySelector('.dish-ingredient-quantity').value) || 0
  })).filter(ing => ing.ingredient_id && ing.quantity > 0);

  if (!name_dish || !price_dish || !category_id || !weight_dish || ingredients.length === 0 || !min_dish) {
    alert('Пожалуйста, заполните все обязательные поля и добавьте хотя бы один ингредиент.');
    return;
  }

  try {
    const category = await firebase.firestore().collection('categories').doc(category_id).get();
    if (!category.exists) {
      alert('Выбранная категория не существует.');
      return;
    }

    const { price_current_dish } = await calculateDishMetrics(ingredients);
    if (price_current_dish === 0) {
      alert('Ошибка: Не удалось рассчитать себестоимость.');
      return;
    }
    const salary_dish = (price_dish - price_current_dish) * SALARY_RATE;
    const price_profit_dish = price_dish - price_current_dish - salary_dish;

    await firebase.firestore().collection('dishes').doc(dishId).update({
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
    loadOrderIngredients();
    alert('Блюдо успешно обновлено!');
  } catch (error) {
    console.error('Ошибка обновления блюда:', error);
    alert('Ошибка при обновлении блюда: ' + error.message);
  }
}

async function loadDishForEdit(dishId) {
  try {
    const dish = await firebase.firestore().collection('dishes').doc(dishId).get();
    if (!dish.exists) {
      alert('Блюдо не найдено');
      return;
    }
    const dishData = dish.data();

    await loadCategories();

    document.getElementById('dish-name').value = dishData.name_dish;
    document.getElementById('dish-description').value = dishData.description_dish;
    document.getElementById('dish-price').value = dishData.price_dish;
    document.getElementById('dish-category').value = dishData.category_id;
    document.getElementById('dish-image').value = dishData.image_dish || '';
    document.getElementById('dish-active').checked = dishData.is_active_dish;
    document.getElementById('dish-weight').value = dishData.weight_dish;
    document.getElementById('dish-min-portions').value = dishData.min_dish;

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
