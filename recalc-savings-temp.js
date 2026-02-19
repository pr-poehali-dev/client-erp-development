// Временный скрипт для пересчёта всех активных договоров сбережений
// Запустить в консоли браузера на странице /savings

async function recalcAllSavings() {
  const token = localStorage.getItem('staff_token');
  if (!token) {
    console.error('Не найден токен авторизации. Войдите в систему.');
    return;
  }

  const apiUrl = 'https://functions.poehali.dev/f35e253c-613f-4ad6-8deb-2c20b4c5d450?resource=savings';
  
  console.log('Запускаю массовый пересчёт графиков...');
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': token
      },
      body: JSON.stringify({
        action: 'recalc_all_active'
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Пересчёт выполнен!');
      console.log(`Обработано: ${result.recalculated} из ${result.total}`);
      if (result.errors && result.errors.length > 0) {
        console.warn('⚠️ Ошибки при пересчёте:', result.errors);
      }
      console.log('Полный результат:', result);
      
      // Перезагрузить страницу чтобы увидеть изменения
      setTimeout(() => window.location.reload(), 1000);
    } else {
      console.error('❌ Ошибка:', result.error || result);
    }
  } catch (error) {
    console.error('❌ Ошибка запроса:', error);
  }
}

// Запуск
recalcAllSavings();
