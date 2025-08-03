let activeOrder = []; // Массив для хранения активного заказа: [{ dishId, name, price, quantity }]

async function loadMenu() {
  if (!firebaseApp) {
    console.error('Firebase не инициализирован.');
    return;
  }
  const db = firebaseApp.firestore();
  const dishesList = document.getElementById('menu-dishes-list');
  if (!dishesList) {
    console.error('Элемент с id="menu-dishes-list" не найден в DOM');
    return;
  }

  try {
    // Загрузка активных категорий
    const categoriesSnapshot = await db.collection('categories')
      .where('is_visible', '==', true)
      .orderBy('number', 'asc')
      .get();
    if (categoriesSnapshot.empty) {
      dishesList.innerHTML = '<p class="text-gray-500">Нет активных категорий</p>';
      return;
    }

    dishesList.innerHTML = '';
    // Проходим по каждой категории
    for (const category of categoriesSnapshot.docs) {
      const categoryData = category.data();
      // Заголовок категории
      const categoryHeader = document.createElement('h2');
      categoryHeader.className = 'text-lg font-semibold mt-4 mb-2';
      categoryHeader.textContent = categoryData.name;
      dishesList.appendChild(categoryHeader);

      // Загрузка активных блюд в категории
      const dishesSnapshot = await db.collection('dishes')
        .where('category_id', '==', category.id)
        .where('is_active_dish', '==', true)
        .orderBy('name_dish', 'asc')
        .get();

      if (dishesSnapshot.empty) {
        const noDishes = document.createElement('p');
        noDishes.className = 'text-gray-500';
        noDishes.textContent = 'Нет активных блюд';
        dishesList.appendChild(noDishes);
        continue;
      }

      // Контейнер для блюд в категории
      const categoryDishes = document.createElement('div');
      categoryDishes.className = 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4';
      dishesSnapshot.forEach((dish) => {
        const dishData = dish.data();
        const dishCard = document.createElement('div');
        dishCard.className = 'menu-dish-card';
        dishCard.onclick = () => addToOrder(dish.id, dishData.name_dish, dishData.price_dish);
        dishCard.innerHTML = `
          <div class="menu-dish-name">${dishData.name_dish}</div>
          <div class="menu-dish-image-container">
            ${dishData.image_dish 
              ? `<img src="${dishData.image_dish}" alt="${dishData.name_dish}" class="menu-dish-image">`
              : '<div class="menu-dish-placeholder"></div>'}
          </div>
          <div class="menu-dish-price">${dishData.price_dish} $</div>
        `;
        categoryDishes.appendChild(dishCard);
      });
      dishesList.appendChild(categoryDishes);
    }
  } catch (error) {
    console.error('Ошибка загрузки меню:', error);
    alert('Ошибка при загрузке меню: ' + error.message);
  }
}

function addToOrder(dishId, name, price) {
  const existingItem = activeOrder.find(item => item.dishId === dishId);
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    activeOrder.push({ dishId, name, price, quantity: 1 });
  }
  updateOrderDisplay();
}

function removeFromOrder(dishId) {
  activeOrder = activeOrder.filter(item => item.dishId !== dishId);
  updateOrderDisplay();
}

function updateOrderQuantity(dishId, change) {
  const item = activeOrder.find(item => item.dishId === dishId);
  if (item) {
    item.quantity = Math.max(1, item.quantity + change);
    updateOrderDisplay();
  }
}

function updateOrderDisplay() {
  const orderItems = document.getElementById('order-items');
  const orderTotal = document.getElementById('order-total');
  if (!orderItems || !orderTotal) {
    console.error('Элементы order-items или order-total не найдены');
    return;
  }

  orderItems.innerHTML = '';
  if (activeOrder.length === 0) {
    orderItems.innerHTML = '<p class="text-gray-500">Заказ пуст</p>';
    orderTotal.textContent = 'Сумма заказа: 0 $';
    return;
  }

  let total = 0;
  activeOrder.forEach(item => {
    const itemTotal = item.price * item.quantity;
    total += itemTotal;
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${item.name} (${item.quantity} x ${item.price} $)</span>
      <div class="order-item-controls">
        <button onclick="updateOrderQuantity('${item.dishId}', -1)" class="btn btn-small btn-secondary">-</button>
        <button onclick="updateOrderQuantity('${item.dishId}', 1)" class="btn btn-small btn-primary">+</button>
        <button onclick="removeFromOrder('${item.dishId}')" class="btn btn-small btn-delete">✖</button>
      </div>
    `;
    orderItems.appendChild(li);
  });
  orderTotal.textContent = `Сумма заказа: ${total.toFixed(2)} $`;
}

function applyPromoCode() {
  const promoCode = document.getElementById('promo-code')?.value;
  if (promoCode) {
    alert(`Промокод "${promoCode}" применен (заглушка)`);
    // Здесь должна быть логика проверки и применения промокода
  } else {
    alert('Введите промокод');
  }
}

function cancelPromoCode() {
  const promoInput = document.getElementById('promo-code');
  if (promoInput) {
    promoInput.value = '';
    alert('Промокод отменен (заглушка)');
    // Здесь должна быть логика отмены промокода
  }
}

window.addEventListener('DOMContentLoaded', () => {
  loadMenu();
});

window.addToOrder = addToOrder;
window.removeFromOrder = removeFromOrder;
window.updateOrderQuantity = updateOrderQuantity;
window.applyPromoCode = applyPromoCode;
window.cancelPromoCode = cancelPromoCode;
