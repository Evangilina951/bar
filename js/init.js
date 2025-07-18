// Подключение Firebase
if (typeof firebase === 'undefined') {
  console.error('Firebase SDK не загружен. Проверьте подключение скриптов.');
  return;
}
console.log('Firebase загружен успешно.');

const firebaseConfig = {
  apiKey: "AIzaSyB3PAQQTpeTxlaeT7cIXqqspGDOcAkBQog",
  authDomain: "evabar-ac842.firebaseapp.com",
  databaseURL: "https://evabar-ac842-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "evabar-ac842",
  storageBucket: "evabar-ac842.firebasestorage.app",
  messagingSenderId: "938549088383",
  appId: "1:938549088383:web:9a6d241040520ccfef6f4a"
};
try {
  firebase.initializeApp(firebaseConfig);
  console.log('Firebase инициализирован.');
} catch (error) {
  console.error('Ошибка инициализации Firebase:', error);
  return;
}
const auth = firebase.auth();
const db = firebase.firestore();
console.log('Firestore доступен:', !!db);

const SALARY_RATE = 0.4;

// Импорт модулей
import './auth.js';
import './menu.js';
import './ingredients.js';
import './order.js';
import './employees.js';
import './delivery.js';

// Инициализация приложения
function initializeApp() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      auth.onAuthStateChanged(user => {
        if (user) {
          loadNav().then(() => {
            document.getElementById('nav-login')?.classList.add('hidden');
            document.querySelectorAll('#nav a:not(#nav-login), #logout').forEach(el => el.classList.remove('hidden'));
            loadMenu();
            loadPromocodes();
            loadDishes();
            loadCategories();
            loadCategoryList();
            loadInventory();
            loadOrderIngredients();
            loadPersonalReport();
            loadEmployees();
            loadDeliveryMenu();
            loadDeliveryOrders();
            loadIngredientsSelect();
          });
        } else {
          document.getElementById('nav-login')?.classList.remove('hidden');
          document.querySelectorAll('#nav a:not(#nav-login), #logout').forEach(el => el.classList.add('hidden'));
          if (window.location.pathname !== '/index.html' && window.location.pathname !== '/bar/index.html') {
            window.location.href = 'index.html';
          }
        }
      });

      const ingredientForm = document.getElementById('ingredient-form');
      if (ingredientForm) {
        ingredientForm.addEventListener('submit', handleIngredientForm);
      } else {
        console.warn('Элемент с id="ingredient-form" не найден на этой странице. Слушатель не добавлен.');
      }
    });
  } else {
    auth.onAuthStateChanged(user => {
      if (user) {
        loadNav().then(() => {
          document.getElementById('nav-login')?.classList.add('hidden');
          document.querySelectorAll('#nav a:not(#nav-login), #logout').forEach(el => el.classList.remove('hidden'));
          loadMenu();
          loadPromocodes();
          loadDishes();
          loadCategories();
          loadCategoryList();
          loadInventory();
          loadOrderIngredients();
          loadPersonalReport();
          loadEmployees();
          loadDeliveryMenu();
          loadDeliveryOrders();
          loadIngredientsSelect();
        });
      } else {
        document.getElementById('nav-login')?.classList.remove('hidden');
        document.querySelectorAll('#nav a:not(#nav-login), #logout').forEach(el => el.classList.add('hidden'));
        if (window.location.pathname !== '/index.html' && window.location.pathname !== '/bar/index.html') {
          window.location.href = 'index.html';
        }
      }
    });

    const ingredientForm = document.getElementById('ingredient-form');
    if (ingredientForm) {
      ingredientForm.addEventListener('submit', handleIngredientForm);
    } else {
      console.warn('Элемент с id="ingredient-form" не найден на этой странице. Слушатель не добавлен.');
    }
  }
}

function handleIngredientForm(event) {
  event.preventDefault();
  const ingredientId = document.getElementById('ingredient-form').dataset.ingredientId;
  const name_product = document.getElementById('ingredient-name').value;
  const stock_quantity_product = parseInt(document.getElementById('ingredient-quantity')?.value) || 0;
  const current_price_product = parseFloat(document.getElementById('ingredient-price')?.value);
  const supplier_product = document.getElementById('ingredient-supplier').value || '';
  const weight_product = parseFloat(document.getElementById('ingredient-weight')?.value) || 0;

  if (ingredientId) {
    editIngredient(ingredientId);
  } else {
    addIngredient(name_product, stock_quantity_product, current_price_product, supplier_product, weight_product);
  }
  document.getElementById('ingredient-form').reset();
}

// Экспортируем функции в глобальную область видимости
window.login = login;
window.logout = logout;
window.addToOrder = addToOrder;
window.placeOrder = placeOrder;
window.addPromocode = addPromocode;
window.addDish = addDish;
window.editDish = editDish;
window.loadDishForEdit = loadDishForEdit;
window.addCategory = addCategory;
window.toggleCategoryVisibility = toggleCategoryVisibility;
window.addIngredient = addIngredient;
window.editIngredient = editIngredient;
window.loadIngredientForEdit = loadIngredientForEdit;
window.deleteIngredient = deleteIngredient;
window.addEmployee = addEmployee;
window.addToDeliveryOrder = addToDeliveryOrder;
window.placeDeliveryOrder = placeDeliveryOrder;
window.updateDeliveryStatus = updateDeliveryStatus;
window.generateGeneralReport = generateGeneralReport;
window.addIngredientRow = addIngredientRow;
window.loadIngredientsSelectForRow = loadIngredientsSelectForRow;
window.editQuantity = editQuantity;
window.saveQuantity = saveQuantity;
window.showIngredientForm = showIngredientForm;
window.hideIngredientForm = hideIngredientForm;
window.toggleUnusedIngredients = toggleUnusedIngredients;

initializeApp();
