async function addCategory() {
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

  const db = firebaseApp.firestore();
  const name = document.getElementById('category-name')?.value;
  const isVisible = document.getElementById('category-visible')?.checked || false;
  const number = parseInt(document.getElementById('category-number')?.value) || 0;
  const categoryId = form.dataset.categoryId || null;

  if (!name) {
    alert('Пожалуйста, введите название категории.');
    return;
  }

  try {
    const existingCategories = await db.collection('categories').where('number', '==', number).get();
    if (!existingCategories.empty && (!categoryId || existingCategories.docs.some(doc => doc.id !== categoryId))) {
      alert('Категория с таким порядковым номером уже существует. Выберите другой номер.');
      return;
    }

    if (categoryId) {
      await db.collection('categories').doc(categoryId).update({ name, isVisible, number });
      loadCategories();
      loadCategoryList();
      cancelCategoryForm();
      alert('Категория успешно обновлена!');
    } else {
      await db.collection('categories').add({ name, isVisible, number });
      loadCategories();
      loadCategoryList();
      cancelCategoryForm();
      alert('Категория успешно добавлена!');
    }
  } catch (error) {
    console.error('Ошибка добавления/обновления категории:', error);
    alert('Ошибка при добавлении/обновлении категории: ' + error.message);
  }
}

function loadCategories() {
  if (!firebaseApp) {
    console.error('Firebase не инициализирован.');
    return;
  }
  const select = document.getElementById('dish-category');
  if (!select) return;
  const db = firebaseApp.firestore();
  db.collection('categories').orderBy('number', 'asc').get()
    .then((categories) => {
      if (select) {
        select.innerHTML = '<option value="">Выберите категорию</option>';
        categories.forEach((cat) => {
          select.innerHTML += `<option value="${cat.id}">${cat.data().name}</option>`;
        });
      }
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
  const db = firebaseApp.firestore();
  db.collection('categories').orderBy("number", "asc").get()
    .then((categories) => {
      list.innerHTML = `
        <input type="text" id="dish-search" class="border p-2 w-full rounded mb-4" placeholder="Поиск по названию блюда">
        <h2 class="text-xl font-bold mb-2">Список категорий</h2>
      `;
      if (categories.empty) {
        list.innerHTML += '<li class="text-gray-500">Категории отсутствуют</li>';
        return;
      }
      categories.forEach((cat) => {
        const catData = cat.data();
        list.innerHTML += `
          <li class="flex items-center justify-between p-2 border-b">
            <span class="cursor-pointer" onclick="toggleCategoryFilter('${cat.id}', '${catData.name}')">${catData.number}. ${catData.name}</span>
            <div class="flex gap-2">
              <button onclick="loadCategoryForEdit('${cat.id}')" class="edit-btn bg-yellow-600 text-white p-2 rounded flex-1">✏️</button>
              <button onclick="deleteCategory('${cat.id}')" class="delete-btn bg-red-600 text-white p-2 rounded flex-1">🗑️</button>
              <button onclick="toggleCategoryVisibility('${cat.id}', ${!catData.isVisible})" class="${catData.isVisible ? 'toggle-active-btn bg-green-600' : 'toggle-inactive-btn bg-gray-600'} text-white p-2 rounded flex-1">${catData.isVisible ? '✔️' : '❌'}</button>
            </div>
          </li>`;
      });
      const searchInput = document.getElementById('dish-search');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          searchQuery = e.target.value;
          loadDishes();
        });
      }
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

  const db = firebaseApp.firestore();
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
      document.getElementById('category-form-button').textContent = 'Сохранить';
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
  const db = firebaseApp.firestore();
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
  const db = firebaseApp.firestore();
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

window.addCategory = addCategory;
window.loadCategories = loadCategories;
window.loadCategoryList = loadCategoryList;
window.toggleCategoryFilter = toggleCategoryFilter;
window.loadCategoryForEdit = loadCategoryForEdit;
window.deleteCategory = deleteCategory;
window.toggleCategoryVisibility = toggleCategoryVisibility;
