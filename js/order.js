async function addPromocode() {
  const code = document.getElementById('promo-code')?.value;
  const discount = parseInt(document.getElementById('promo-discount')?.value);
  if (!code || !discount) {
    alert('Пожалуйста, заполните код и скидку.');
    return;
  }
  try {
    await firebase.firestore().collection('promocodes').add({ code, discount });
    loadPromocodes();
    alert('Промокод добавлен!');
  } catch (error) {
    console.error('Ошибка добавления промокода:', error);
    alert('Ошибка при добавлении промокода: ' + error.message);
  }
}

async function loadPromocodes() {
  if (!document.getElementById('promocodes-list')) return;
  try {
    const promocodes = await firebase.firestore().collection('promocodes').get();
    const list = document.getElementById('promocodes-list');
    list.innerHTML = '';
    if (promocodes.empty) {
      list.innerHTML = '<li>Промокоды отсутствуют</li>';
      return;
    }
    promocodes.forEach(promo => {
      list.innerHTML += `<li>${promo.data().code} - ${promo.data().discount}%</li>`;
    });
  } catch (error) {
    console.error('Ошибка загрузки промокодов:', error);
  }
}

async function loadOrderIngredients() {
  if (!document.getElementById('order-ingredients-list')) {
    console.error('Элемент с id="order-ingredients-list" не найден');
    return;
  }
  try {
    console.log('Загрузка таблицы заказов началась...');
    const dishes = await firebase.firestore().collection('dishes').get();
    const ingredients = await firebase.firestore().collection('ingredients').get();
    const ingredientMap = {};
    ingredients.forEach(ing => {
      ingredientMap[ing.id] = {
        name: ing.data().name_product || 'Неизвестный ингредиент',
        stock: ing.data().stock_quantity_product || 0,
        price: ing.data().current_price_product || 0,
        weight: ing.data().weight_product || 0,
        supplier: ing.data().supplier_product || 'Неизвестно'
      };
    });

    const requiredIngredients = {};
    dishes.forEach(dish => {
      const dishData = dish.data();
      if (dishData.min_dish > 0 && dishData.is_active_dish) {
        (dishData.ingredients || []).forEach(ing => {
          const required = ing.quantity * dishData.min_dish;
          if (!requiredIngredients[ing.ingredient_id]) {
            requiredIngredients[ing.ingredient_id] = { quantity: 0, name: ingredientMap[ing.ingredient_id]?.name || 'Неизвестный ингредиент' };
          }
          requiredIngredients[ing.ingredient_id].quantity += required;
        });
      }
    });

    const list = document.getElementById('order-ingredients-list');
    list.innerHTML = '<h2 class="text-xl font-bold mb-2">Заказать</h2>';
    let hasItems = false;
    const supplierOrders = {};
    for (const [ingId, data] of Object.entries(requiredIngredients)) {
      const stock = ingredientMap[ingId]?.stock || 0;
      const needed = data.quantity - stock;
      if (needed > 0) {
        const supplier = ingredientMap[ingId]?.supplier || 'Неизвестно';
        if (!supplierOrders[supplier]) {
          supplierOrders[supplier] = [];
        }
        supplierOrders[supplier].push({
          name: data.name,
          quantity: needed,
          price: ingredientMap[ingId]?.price || 0,
          weight: ingredientMap[ingId]?.weight || 0
        });
        hasItems = true;
      }
    }

    if (!hasItems) {
      list.innerHTML += '<p class="text-gray-500">Ингредиенты для заказа отсутствуют</p>';
    } else {
      for (const [supplier, items] of Object.entries(supplierOrders)) {
        list.innerHTML += `<h3 class="text-lg font-semibold mt-2">Заказ ${supplier}:</h3>`;
        let totalCost = 0;
        let totalWeight = 0;
        items.forEach(item => {
          const cost = item.quantity * item.price;
          const weight = item.quantity * item.weight;
          totalCost += cost;
          totalWeight += weight;
          list.innerHTML += `${item.name} ${item.quantity} шт ${weight.toFixed(2)} кг ${cost.toFixed(2)}$<br>`;
        });
        list.innerHTML += `Итого: ${totalWeight.toFixed(2)} кг ${totalCost.toFixed(2)}$<br>`;
      }
    }
    console.log('Таблица заказов отрендерена. HTML:', list.innerHTML);
  } catch (error) {
    console.error('Ошибка загрузки заказа ингредиентов:', error);
    alert('Ошибка при загрузке заказа ингредиентов: ' + error.message);
  }
}

async function loadPersonalReport() {
  if (!document.getElementById('personal-report-list')) return;
  try {
    const orders = await firebase.firestore().collection('orders').where('user', '==', firebase.auth().currentUser.uid).get();
    const list = document.getElementById('personal-report-list');
    list.innerHTML = '';
    if (orders.empty) {
      list.innerHTML = '<li>Заказы отсутствуют</li>';
      return;
    }
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
    const orders = await firebase.firestore().collection('orders').where('timestamp', '>=', start).where('timestamp', '<=', end).get();
    const list = document.getElementById('general-report-list');
    list.innerHTML = '';
    if (orders.empty) {
      list.innerHTML = '<li>Заказы отсутствуют</li>';
      return;
    }
    orders.forEach(order => {
      list.innerHTML += `<li>Заказ: ${order.data().items.map(item => item.name).join(', ')}</li>`;
    });
  } catch (error) {
    console.error('Ошибка генерации общей отчетности:', error);
  }
}
