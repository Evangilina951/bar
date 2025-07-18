async function loadDeliveryMenu() {
  if (!document.getElementById('delivery-menu')) return;
  try {
    const categories = await firebase.firestore().collection('categories').where('isVisible', '==', true).orderBy('number', 'asc').get();
    const dishes = await firebase.firestore().collection('dishes').where('is_active_dish', '==', true).get();
    const deliveryMenu = document.getElementById('delivery-menu');
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
                <p>${dishData.description_dish}</p>
                <p>Вес: ${dishData.weight_dish} кг</p>
                <p>Мин. порций: ${dishData.min_dish}</p>
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
  const comment = document.getElementById('delivery-comment')?.value;
  if (!address) {
    alert('Пожалуйста, укажите адрес доставки.');
    return;
  }
  try {
    await firebase.firestore().collection('delivery-orders').add({
      items: deliveryOrderItems,
      address,
      comment,
      user: firebase.auth().currentUser.uid,
      status: 'pending',
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    deliveryOrderItems = [];
    renderDeliveryOrder();
    alert('Заказ доставки оформлен!');
    loadOrderIngredients();
  } catch (error) {
    console.error('Ошибка оформления заказа доставки:', error);
    alert('Ошибка при оформлении заказа доставки: ' + error.message);
  }
}

async function loadDeliveryOrders() {
  if (!document.getElementById('delivery-orders-list')) return;
  try {
    const orders = await firebase.firestore().collection('delivery-orders').get();
    const list = document.getElementById('delivery-orders-list');
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

async function updateDeliveryStatus(orderId, status) {
  try {
    await firebase.firestore().collection('delivery-orders').doc(orderId).update({ status });
    loadDeliveryOrders();
  } catch (error) {
    console.error('Ошибка обновления статуса доставки:', error);
    alert('Ошибка при обновлении статуса доставки: ' + error.message);
  }
}
