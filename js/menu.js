let orderItems = [];
let promoDiscount = 0;

function loadMenuDishes() {
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
  
  db.collection('categories').where('isVisible', '==', true).orderBy('number', 'asc').get()
    .then((categories) => {
      list.innerHTML = '';
      if (categories.empty) {
        list.innerHTML = '<p class="text-gray-500">Категории отсутствуют</p>';
        return;
      }
      const categoryPromises = categories.docs.map(async (cat) => {
        const catData = cat.data();
        const dishes = await db.collection('dishes')
          .where('category_id', '==', cat.id)
          .where('is_active_dish', '==', true)
          .get();
        if (!dishes.empty) {
          list.innerHTML += `<h2 class="text-lg font-semibold mt-4 mb-2">${catData.number}. ${catData.name}</h2>`;
          dishes.forEach((dish) => {
            const dishData = dish.data();
            renderMenuDishCard(dish.id, dishData);
          });
        }
      });
      Promise.all(categoryPromises)
        .then(() => updateOrderSummary())
        .catch((error) => {
          console.error('Ошибка загрузки блюд:', error);
          alert('Ошибка при загрузке блюд: ' + error.message);
        });
    })
    .catch((error) => {
      console.error('Ошибка загрузки категорий:', error);
      alert('Ошибка при загрузке категорий: ' + error.message);
    });
}

function renderMenuDishCard(dishId, dishData) {
  const list = document.getElementById('dishes-list');
  const card = document.createElement('div');
  card.className = 'menu-dish-card bg-white rounded-lg shadow p-2 cursor-pointer';
  card.onclick = () => addToOrder(dishId, dishData);
  card.innerHTML = `
    <div class="menu-dish-name font-semibold text-center mb-2">${dishData.name_dish}</div>
    <div class="menu-dish-image-container flex justify-center mb-2">
      ${dishData.image_dish 
        ? `<img src="${dishData.image_dish}" class="menu-dish-image" alt="${dishData.name_dish}">`
        : '<div class="menu-dish-placeholder"></div>'
      }
    </div>
    <div class="menu-dish-price text-green-600 text-center font-semibold">$${dishData.price_dish.toFixed(2)}</div>
  `;
  list.appendChild(card);
}

function addToOrder(dishId, dishData) {
  const existingItem = orderItems.find(item => item.dishId === dishId);
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    orderItems.push({
      dishId,
      name: dishData.name_dish,
      price: dishData.price_dish,
      quantity: 1,
      ingredients: dishData.ingredients || []
    });
  }
  updateOrderSummary();
}

function removeFromOrder(dishId) {
  orderItems = orderItems.filter(item => item.dishId !== dishId);
  updateOrderSummary();
}

function updateOrderItemQuantity(dishId, newQuantity) {
  const item = orderItems.find(item => item.dishId === dishId);
  if (item) {
    newQuantity = parseInt(newQuantity) || 0;
    if (newQuantity <= 0) {
      removeFromOrder(dishId);
    } else {
      item.quantity = newQuantity;
    }
    updateOrderSummary();
  }
}

async function updateOrderSummary() {
  const orderItemsContainer = document.getElementById('order-items');
  const orderTotalElement = document.getElementById('order-total-amount');
  const missingIngredientsElement = document.getElementById('missing-ingredients');
  
  if (!orderItemsContainer || !orderTotalElement || !missingIngredientsElement) {
    console.error('Не найдены элементы DOM для активного заказа');
    return;
  }

  orderItemsContainer.innerHTML = '';
  let total = 0;
  const db = firebaseApp.firestore();
  const ingredientRequirements = {};

  for (const item of orderItems) {
    const subtotal = item.price * item.quantity;
    total += subtotal;
    item.ingredients.forEach(ing => {
      if (!ingredientRequirements[ing.ingredient_id]) {
        ingredientRequirements[ing.ingredient_id] = 0;
      }
      ingredientRequirements[ing.ingredient_id] += ing.quantity * item.quantity;
    });

    const orderItem = document.createElement('div');
    orderItem.className = 'order-item flex items-center justify-between mb-2';
    orderItem.innerHTML = `
      <span>${item.name} ($${item.price.toFixed(2)})</span>
      <div class="flex items-center gap-2">
        <button onclick="updateOrderItemQuantity('${item.dishId}', ${item.quantity - 1})" class="btn btn-small bg-gray-600 text-white">-</button>
        <input type="number" value="${item.quantity}" min="1" class="border p-1 w-12 text-center" onchange="updateOrderItemQuantity('${item.dishId}', this.value)">
        <button onclick="updateOrderItemQuantity('${item.dishId}', ${item.quantity + 1})" class="btn btn-small bg-gray-600 text-white">+</button>
        <button onclick="removeFromOrder('${item.dishId}')" class="btn btn-small btn-delete">✖</button>
      </div>
    `;
    orderItemsContainer.appendChild(orderItem);
  }

  total = total * (1 - promoDiscount);
  orderTotalElement.textContent = `$${total.toFixed(2)}`;

  const missingIngredients = [];
  for (const [ingredientId, requiredQuantity] of Object.entries(ingredientRequirements)) {
    try {
      const ingredient = await db.collection('ingredients').doc(ingredientId).get();
      if (ingredient.exists) {
        const ingData = ingredient.data();
        const stock = ingData.stock_quantity_product || 0;
        if (stock < requiredQuantity) {
          missingIngredients.push(`${ingData.name_product} (${(requiredQuantity - stock).toFixed(2)})`);
        }
      }
    } catch (error) {
      console.error(`Ошибка проверки ингредиента ${ingredientId}:`, error);
    }
  }

  if (missingIngredients.length > 0) {
    missingIngredientsElement.textContent = `Не хватает: ${missingIngredients.join(', ')}`;
    missingIngredientsElement.classList.remove('hidden');
  } else {
    missingIngredientsElement.classList.add('hidden');
  }
}

function applyPromoCode() {
  const promoCode = document.getElementById('promo-code')?.value;
  if (!promoCode) {
    alert('Введите промокод.');
    return;
  }
  const db = firebaseApp.firestore();
  db.collection('promocodes').where('code', '==', promoCode).get()
    .then((snapshot) => {
      if (snapshot.empty) {
        alert('Промокод недействителен.');
        promoDiscount = 0;
      } else {
        const promoData = snapshot.docs[0].data();
        if (promoData.isActive && (!promoData.expiryDate || new Date(promoData.expiryDate) > new Date())) {
          promoDiscount = promoData.discount / 100;
          alert(`Промокод применен! Скидка: ${promoData.discount}%`);
        } else {
          alert('Промокод истек или неактивен.');
          promoDiscount = 0;
        }
      }
      updateOrderSummary();
    })
    .catch((error) => {
      console.error('Ошибка проверки промокода:', error);
      alert('Ошибка при проверке промокода: ' + error.message);
    });
}

function submitOrder() {
  if (!firebaseApp) {
    alert('Firebase не инициализирован. Перезагрузите страницу.');
    return;
  }
  if (orderItems.length === 0) {
    alert('Заказ пуст. Добавьте блюда в заказ.');
    return;
  }
  const db = firebaseApp.firestore();
  const orderData = {
    items: orderItems.map(item => ({
      dishId: item.dishId,
      name: item.name,
      quantity: item.quantity,
      price: item.price
    })),
    total: parseFloat(document.getElementById('order-total-amount').textContent.replace('$', '')),
    createdAt: new Date().toISOString(),
    status: 'pending'
  };
  db.collection('orders').add(orderData)
    .then(() => {
      orderItems = [];
      promoDiscount = 0;
      document.getElementById('promo-code').value = '';
      updateOrderSummary();
      alert('Заказ успешно оформлен!');
    })
    .catch((error) => {
      console.error('Ошибка оформления заказа:', error);
      alert('Ошибка при оформлении заказа: ' + error.message);
    });
}

function cancelOrder() {
  orderItems = [];
  promoDiscount = 0;
  document.getElementById('promo-code').value = '';
  updateOrderSummary();
}

window.addEventListener('DOMContentLoaded', () => {
  loadMenuDishes();
});

window.addToOrder = addToOrder;
window.removeFromOrder = removeFromOrder;
window.updateOrderItemQuantity = updateOrderItemQuantity;
window.applyPromoCode = applyPromoCode;
window.submitOrder = submitOrder;
window.cancelOrder = cancelOrder;
