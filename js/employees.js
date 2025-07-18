async function addEmployee() {
  const name = document.getElementById('employee-name')?.value;
  const phone = document.getElementById('employee-phone')?.value;
  if (!name || !phone) {
    alert('Пожалуйста, заполните все поля для сотрудника.');
    return;
  }
  try {
    await firebase.firestore().collection('employees').add({ name, phone });
    loadEmployees();
    alert('Сотрудник успешно добавлен!');
  } catch (error) {
    console.error('Ошибка добавления сотрудника:', error);
    alert('Ошибка при добавлении сотрудника: ' + error.message);
  }
}

async function loadEmployees() {
  if (!document.getElementById('employees-list')) return;
  try {
    const employees = await firebase.firestore().collection('employees').get();
    const list = document.getElementById('employees-list');
    list.innerHTML = '';
    if (employees.empty) {
      list.innerHTML = '<li>Сотрудники отсутствуют</li>';
      return;
    }
    employees.forEach(emp => {
      list.innerHTML += `<li>${emp.data().name} - ${emp.data().phone}</li>`;
    });
  } catch (error) {
    console.error('Ошибка загрузки сотрудников:', error);
  }
}
