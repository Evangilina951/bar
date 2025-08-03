let showAllIngredients = false;

function loadInventory() {
  if (!firebaseApp) {
    console.error('Firebase не инициализирован.');
    return;
  }
  const list = document.getElementById('inventory-list');
  const orderList = document.getElementById('order-list');
  if (!list || !orderList) return;

  const db = firebaseApp.firestore();
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
              <td class="border p-2 price-cell" data-ingredient-id="${ing.id}">${ingData.current_price_product || 0}</td>
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

          const priceCells = tbody.querySelectorAll('.price-cell');
          priceCells.forEach(cell => {
            cell.addEventListener('click', function() {
              const currentValue = this.textContent;
              const ingredientId = this.dataset.ingredientId;
              this.innerHTML = `
                <input type="number" class="border p-1 w-full rounded" value="${currentValue}" min="0" step="0.01">
              `;
              const input = this.querySelector('input');
              input.focus();
              input.addEventListener('blur', () => editIngredientPrice(ingredientId, input.value));
              input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                  editIngredientPrice(ingredientId, input.value);
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
          alert('Ошибка при загрузки блюд: ' + error.message);
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
  const db = firebaseApp.firestore();
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

function editIngredientPrice(ingredientId, newPrice) {
  if (!firebaseApp) {
    alert('Firebase не инициализирован. Перезагрузите страницу.');
    return;
  }
  const db = firebaseApp.firestore();
  const price = parseFloat(newPrice) || 0;
  if (price < 0) {
    alert('Цена не может быть отрицательной.');
    return;
  }
  db.collection('ingredients').doc(ingredientId).update({
    current_price_product: price
  })
    .then(() => {
      loadInventory();
      console.log(`Цена ингредиента ${ingredientId} обновлена: ${price}`);
    })
    .catch((error) => {
      console.error('Ошибка обновления цены ингредиента:', error);
      alert('Ошибка при обновлении цены: ' + error.message);
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

  const db = firebaseApp.firestore();
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
  const db = firebaseApp.firestore();
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

  const db = firebaseApp.firestore();
  const name_product = document.getElementById('ingredient-name')?.value;
  const stock_quantity_product = document.getElementById('ingredient-quantity')?.value;
  const current_price_product = document.getElementById('ingredient-price')?.value;
  const supplier_product = document.getElementById('ingredient-supplier')?.value || '';
  const weight_product = document.getElementById('ingredient-weight')?.value;

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

window.loadInventory = loadInventory;
window.editIngredientQuantity = editIngredientQuantity;
window.editIngredientPrice = editIngredientPrice;
window.toggleAllIngredients = toggleAllIngredients;
window.loadIngredientForEdit = loadIngredientForEdit;
window.deleteIngredient = deleteIngredient;
window.saveIngredient = saveIngredient;
