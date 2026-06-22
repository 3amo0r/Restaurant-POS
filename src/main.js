const { invoke } = window.__TAURI__.core;

let currentUserRole = null;
let currentActiveTable = null;
let currentCart = [];
let dynamicTables = [];
let kitchenOrders = [];

// سجل العمليات المالي وتتبع الضرائب
let salesHistory = [];
let bestSellers = {};

const SERVICE_RATE = 0.12; 
const VAT_RATE = 0.14;     

let menuCategories = ["برجر", "بيتزا", "مشروبات"];

// قاعدة الحسابات المؤمنة الافتراضية
let systemAccounts = {
  cashier: { username: "cashier", password: "123" },
  manager: { username: "manager", password: "456" },
  owner: { username: "owner", password: "789" }
};

let selectedRoleForLogin = null;

let inventoryItems = [
  { id: 1, name: "لحم مفروم كندوز", quantity: 45, unit: "كيلوجرام", alertLimit: 10 },
  { id: 2, name: "جبنة موتزاريلا طبيعي", quantity: 8, unit: "كيلوجرام", alertLimit: 10 },
  { id: 3, name: "دقيق فاخر", quantity: 120, unit: "كيلوجرام", alertLimit: 20 },
  { id: 4, name: "عبوات بيبسي كنز", quantity: 150, unit: "عدد/قطعة", alertLimit: 24 },
];

let menuItems = [
  { id: 101, name: "شيز برجر كلاسيك", price: 120, category: "برجر" },
  { id: 102, name: "دبل برجر مشوي", price: 170, category: "برجر" },
  { id: 103, name: "بيتزا مارجريتا", price: 140, category: "بيتزا" },
  { id: 104, name: "بيتزا رانش دجاج", price: 190, category: "بيتزا" },
  { id: 105, name: "بيبسي كولا", price: 25, category: "مشروبات" },
];

// === [1] نظام التحكم في شاشة الدخول والأمان ===
function selectRoleForLogin(role, label) {
  selectedRoleForLogin = role;
  document.getElementById("roles-selection-grid").style.display = "none";
  document.getElementById("login-credentials-form").style.display = "block";
  document.getElementById("selected-role-title").innerText = `حساب: ${label}`;
  document.getElementById("login-username").value = "";
  document.getElementById("login-password").value = "";
}

function backToRoles() {
  selectedRoleForLogin = null;
  document.getElementById("login-credentials-form").style.display = "none";
  document.getElementById("roles-selection-grid").style.display = "grid";
}

async function submitLogin() {
  const usernameInput = document.getElementById("login-username").value.trim();
  const passwordInput = document.getElementById("login-password").value;
  
  if(!usernameInput || !passwordInput) {
    return alert("الرجاء إدخال اسم المستخدم وكلمة المرور!");
  }

  const account = systemAccounts[selectedRoleForLogin];
  
  if (usernameInput === account.username && passwordInput === account.password) {
    try {
      await invoke("login_user", { role: selectedRoleForLogin });
      currentUserRole = selectedRoleForLogin;
      
      document.getElementById("login-screen").style.display = "none";
      document.getElementById("main-app-container").style.display = "flex";
      
      let roleText = currentUserRole === "owner" ? "المالك" : currentUserRole === "manager" ? "مدير الفرع" : "الكاشير";
      document.getElementById("user-role-display").innerText = `المستوى: ${roleText}`;
      
      if(currentUserRole === "owner" || currentUserRole === "manager") {
        document.getElementById("admin-settings-btn").style.display = "block";
        document.getElementById("admin-menu-btn").style.display = "block";
        document.getElementById("admin-inventory-btn").style.display = "block";
        document.getElementById("admin-analytics-btn").style.display = "block"; 
      } else {
        document.getElementById("admin-settings-btn").style.display = "none";
        document.getElementById("admin-menu-btn").style.display = "none";
        document.getElementById("admin-inventory-btn").style.display = "none";
        document.getElementById("admin-analytics-btn").style.display = "none"; 
      }
      
      updateRestaurantNameUI();
      generateTablesBasedOnCount(6);
      backToRoles(); 
      
    } catch (error) {
      alert(error);
    }
  } else {
    alert("❌ اسم المستخدم أو كلمة المرور غير صحيحة!");
  }
}

function logout() {
  currentUserRole = null;
  document.getElementById("main-app-container").style.display = "none";
  document.getElementById("login-screen").style.display = "flex";
}

async function updateRestaurantNameUI() {
  const name = await invoke("get_restaurant_name");
  document.getElementById("app-logo").innerText = name;
}

// === [2] لوحة التحكم وإعدادات الطاولات والأمان ===
function generateTablesBasedOnCount(count) {
  dynamicTables = [];
  for (let i = 1; i <= count; i++) {
    dynamicTables.push({ id: i, number: `طاولة ${i}`, status: "available" });
  }
  renderDynamicTables();
}

function renderDynamicTables() {
  const grid = document.getElementById("tables-grid");
  if (!grid) return;
  grid.innerHTML = "";

  dynamicTables.forEach((table) => {
    const tableDiv = document.createElement("div");
    tableDiv.className = `table-card ${table.status}`;
    let statusText = table.status === "occupied" ? "جاري التجهيز 🍳" : table.status === "billing" ? "جاهز / طلب الحساب 💰" : "فارغة ✅";
    
    tableDiv.innerHTML = `
      <div class="table-number">${table.number}</div>
      <div class="table-status">${statusText}</div>
    `;
    
    tableDiv.addEventListener("click", () => openOrderModal(table));
    grid.appendChild(tableDiv);
  });
}

async function saveRestaurantSetup() {
  const name = document.getElementById("setup-restaurant-name").value;
  const tables = parseInt(document.getElementById("setup-tables-count").value);
  if(!name || isNaN(tables) || tables <= 0) return alert("الرجاء إدخال بيانات صحيحة!");
  
  const response = await invoke("save_restaurant_settings", { name: name, tables: tables });
  alert(response);
  updateRestaurantNameUI();
  generateTablesBasedOnCount(tables);
}

function loadAccountSettingsToFields() {
  const selectedRole = document.getElementById("secure-role-select").value;
  const account = systemAccounts[selectedRole];
  document.getElementById("secure-username-input").value = account.username;
  document.getElementById("secure-password-input").value = account.password;
}

function saveAccountSecuritySettings() {
  const selectedRole = document.getElementById("secure-role-select").value;
  const newUsername = document.getElementById("secure-username-input").value.trim();
  const newPassword = document.getElementById("secure-password-input").value;

  if(!newUsername || !newPassword) {
    return alert("لا يمكن ترك الحقول فارغة!");
  }

  systemAccounts[selectedRole].username = newUsername;
  systemAccounts[selectedRole].password = newPassword;
  alert(`🔒 تم تحديث بيانات الحساب والأمان بنجاح!`);
}

// === [3] الحسابات والمنيو والكاشير ===
function openOrderModal(table) {
  currentActiveTable = table;
  currentCart = []; 
  document.getElementById("modal-table-title").innerText = `تفاصيل الطلب - ${table.number}`;
  updateCartUI();
  renderMenuItems();
  document.getElementById("order-modal").classList.add("show");
}

function renderMenuItems() {
  const container = document.getElementById("menu-items-grid");
  if (!container) return;
  container.innerHTML = "";
  
  menuItems.forEach(item => {
    const card = document.createElement("div");
    card.className = "item-card";
    card.innerHTML = `
      <span class="item-name">${item.name}</span>
      <span class="item-price">${item.price} ج.م</span>
    `;
    card.addEventListener("click", () => addToCart(item));
    container.appendChild(card);
  });
}

function addToCart(item) {
  const existing = currentCart.find(i => i.id === item.id);
  if (existing) { existing.quantity++; } else { currentCart.push({ ...item, quantity: 1 }); }
  updateCartUI();
}

function updateCartUI() {
  const container = document.getElementById("invoice-items");
  if (!container) return;
  container.innerHTML = "";
  let subtotal = 0;
  
  currentCart.forEach(item => {
    subtotal += item.price * item.quantity;
    const row = document.createElement("div");
    row.className = "invoice-item-row";
    row.innerHTML = `
      <span>${item.name} (x${item.quantity})</span>
      <span>${item.price * item.quantity} ج.م</span>
    `;
    container.appendChild(row);
  });
  
  let serviceCharge = subtotal * SERVICE_RATE;
  let vatAmount = (subtotal + serviceCharge) * VAT_RATE;
  let grandTotal = subtotal + serviceCharge + vatAmount;
  
  document.getElementById("subtotal-price").innerText = subtotal.toFixed(2);
  document.getElementById("service-price").innerText = serviceCharge.toFixed(2);
  document.getElementById("vat-price").innerText = vatAmount.toFixed(2);
  document.getElementById("total-price").innerText = grandTotal.toFixed(2);
}

// === [4] الطباعة الحرارية والمطبخ ===
async function printReceipt(tableName, subtotal, items) {
  const restaurantName = await invoke("get_restaurant_name");
  let service = subtotal * SERVICE_RATE;
  let vat = (subtotal + service) * VAT_RATE;
  const now = new Date();
  const dateTimeStr = now.toLocaleDateString('ar-EG') + " " + now.toLocaleTimeString('ar-EG');

  document.getElementById("receipt-brand-name").innerText = restaurantName;
  document.getElementById("receipt-table-num").innerText = `المصدر: ${tableName}`;
  document.getElementById("receipt-date-time").innerText = `الوقت: ${dateTimeStr}`;

  const tbody = document.getElementById("receipt-items-body");
  tbody.innerHTML = "";
  items.forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${item.name}</td><td style="text-align:center;">${item.quantity}</td><td style="text-align:left;">${(item.price * item.quantity).toFixed(2)}</td>`;
    tbody.appendChild(tr);
  });

  document.getElementById("r-subtotal").innerText = subtotal.toFixed(2);
  document.getElementById("r-service").innerText = service.toFixed(2);
  document.getElementById("r-vat").innerText = vat.toFixed(2);
  document.getElementById("r-total").innerText = (subtotal + service + vat).toFixed(2);

  setTimeout(() => { window.print(); }, 800);
}

function sendOrderToKitchen(tableName, items) {
  kitchenOrders.push({ id: Date.now(), tableName: tableName, items: [...items], elapsedMinutes: 0 });
  renderKitchenOrders();
}

function renderKitchenOrders() {
  const grid = document.getElementById("kitchen-orders-grid");
  if (!grid) return;
  grid.innerHTML = "";

  if(kitchenOrders.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px; font-size: 18px;">🚪 لا توجد طلبات في المطبخ</div>`;
    return;
  }

  kitchenOrders.forEach(order => {
    const card = document.createElement("div");
    card.className = "kitchen-card";
    let itemsHtml = "";
    order.items.forEach(item => { itemsHtml += `<div class="kitchen-item-row"><span>${item.name}</span><span class="kitchen-item-qty">x${item.quantity}</span></div>`; });

    card.innerHTML = `
      <div class="kitchen-card-header"><span>${order.tableName}</span></div>
      <div class="kitchen-items-list">${itemsHtml}</div>
      <button class="kitchen-ready-btn" id="k-ready-${order.id}">✅ جاهز للتقديم</button>
    `;
    grid.appendChild(card);
    
    document.getElementById(`k-ready-${order.id}`).addEventListener("click", () => {
      kitchenOrders = kitchenOrders.filter(o => o.id !== order.id);
      renderKitchenOrders();
      const table = dynamicTables.find(t => t.number === order.tableName);
      if(table) { table.status = "billing"; renderDynamicTables(); }
    });
  });
}

// === [5] إدارة المخازن والمنيو الديناميكي ===
function renderInventoryTable() {
  const tbody = document.getElementById("admin-inventory-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  inventoryItems.forEach(item => {
    const isCritical = item.quantity <= item.alertLimit;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${item.name}</strong></td>
      <td style="font-weight: bold;">${item.quantity}</td>
      <td>${item.unit}</td>
      <td>${isCritical ? '⚠️ حرج' : '✅ آمن'}</td>
      <td><button class="delete-btn" id="del-inv-${item.id}">حذف</button></td>
    `;
    tbody.appendChild(tr);
    document.getElementById(`del-inv-${item.id}`).addEventListener("click", () => {
      inventoryItems = inventoryItems.filter(i => i.id !== item.id);
      renderInventoryTable();
    });
  });
}

function updateCategorySelectDropdown() {
  const select = document.getElementById("new-item-category");
  if (!select) return;
  select.innerHTML = "";
  menuCategories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat; opt.innerText = cat; select.appendChild(opt);
  });
}

function renderAdminMenuTable() {
  const tbody = document.getElementById("admin-menu-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  menuItems.forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${item.name}</strong></td>
      <td>${item.category}</td>
      <td id="price-display-${item.id}">${item.price} ج.م</td>
      <td>
        <div style="display: flex; gap: 5px;">
          <input type="number" id="update-price-input-${item.id}" style="width: 70px; text-align: center;">
          <button class="save-settings-btn" id="save-p-${item.id}" style="margin:0; padding:4px;">حفظ</button>
        </div>
      </td>
      <td><button class="delete-btn" id="del-menu-${item.id}">حذف</button></td>
    `;
    tbody.appendChild(tr);

    document.getElementById(`save-p-${item.id}`).addEventListener("click", () => {
      const np = parseFloat(document.getElementById(`update-price-input-${item.id}`).value);
      if(!isNaN(np) && np > 0) {
        item.price = np;
        document.getElementById(`price-display-${item.id}`).innerText = `${np} ج.م`;
      }
    });

    document.getElementById(`del-menu-${item.id}`).addEventListener("click", () => {
      menuItems = menuItems.filter(i => i.id !== item.id);
      renderAdminMenuTable();
    });
  });
}

function recordSaleToAnalytics(tableName, subtotal, items) {
  let service = subtotal * SERVICE_RATE;
  let vat = (subtotal + service) * VAT_RATE;
  salesHistory.push({ id: `INV-${Math.floor(1000+Math.random()*9000)}`, source: tableName, subtotal: subtotal, service: service, vat: vat, grandTotal: subtotal+service+vat });
  items.forEach(item => { bestSellers[item.name] = (bestSellers[item.name] || 0) + item.quantity; });
}

function renderAnalyticsDashboard() {
  let ts = 0, tsc = 0, tv = 0;
  salesHistory.forEach(s => { ts += s.grandTotal; tsc += s.service; tv += s.vat; });
  document.getElementById("stat-total-sales").innerText = ts.toFixed(2);
  document.getElementById("stat-total-service").innerText = tsc.toFixed(2);
  document.getElementById("stat-total-vat").innerText = tv.toFixed(2);

  const tbody = document.getElementById("admin-sales-table-body");
  tbody.innerHTML = "";
  salesHistory.forEach(s => {
    tbody.innerHTML += `<tr><td>${s.id}</td><td>${s.source}</td><td>${s.subtotal}</td><td>${s.service}</td><td>${s.vat}</td><td>${s.grandTotal}</td></tr>`;
  });
}

// === [6] ربط الأحداث والأزرار برمجياً بالكامل لضمان الاستجابة ===
document.addEventListener("DOMContentLoaded", () => {

  // ربط أزرار شاشة الدخول الموحدة
  document.getElementById("btn-login-cashier").addEventListener("click", () => selectRoleForLogin('cashier', '💰 كاشير'));
  document.getElementById("btn-login-manager").addEventListener("click", () => selectRoleForLogin('manager', '💼 مدير الفرع'));
  document.getElementById("btn-login-owner").addEventListener("click", () => selectRoleForLogin('owner', '👑 مالك المطعم'));
  document.getElementById("btn-back-to-roles").addEventListener("click", backToRoles);
  document.getElementById("btn-submit-login").addEventListener("click", submitLogin);
  document.getElementById("btn-logout").addEventListener("click", logout);

  // ربط أزرار الإعدادات والمنيو والمخزن
  document.getElementById("btn-save-restaurant-setup").addEventListener("click", saveRestaurantSetup);
  document.getElementById("btn-save-security-settings").addEventListener("click", saveAccountSecuritySettings);
  document.getElementById("secure-role-select").addEventListener("change", loadAccountSettingsToFields);
  
  document.getElementById("btn-add-category").addEventListener("click", () => {
    const name = document.getElementById("new-category-name").value.trim();
    if(name && !menuCategories.includes(name)) { menuCategories.push(name); updateCategorySelectDropdown(); document.getElementById("new-category-name").value=""; alert("تم!"); }
  });

  document.getElementById("btn-add-menu-item").addEventListener("click", () => {
    const name = document.getElementById("new-item-name").value.trim();
    const price = parseFloat(document.getElementById("new-item-price").value);
    const cat = document.getElementById("new-item-category").value;
    if(name && price > 0) { menuItems.push({ id: Date.now(), name, price, category: cat }); renderAdminMenuTable(); }
  });

  // التنقل بين شاشات الـ Sidebar
  const navButtons = document.querySelectorAll(".nav-btn");
  navButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      if(btn.id === "btn-logout") return;
      navButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      
      document.getElementById("tables-view").style.display = "none";
      document.getElementById("kitchen-view").style.display = "none";
      document.getElementById("inventory-view").style.display = "none";
      document.getElementById("settings-view").style.display = "none";
      document.getElementById("menu-management-view").style.display = "none";
      document.getElementById("analytics-view").style.display = "none";
      
      if(btn.id === "admin-settings-btn") { document.getElementById("settings-view").style.display = "block"; loadAccountSettingsToFields(); }
      else if (btn.id === "admin-menu-btn") { document.getElementById("menu-management-view").style.display = "block"; updateCategorySelectDropdown(); renderAdminMenuTable(); }
      else if (btn.id === "admin-inventory-btn") { document.getElementById("inventory-view").style.display = "block"; renderInventoryTable(); }
      else if (btn.id === "admin-analytics-btn") { document.getElementById("analytics-view").style.display = "block"; renderAnalyticsDashboard(); }
      else if (btn.id === "nav-kitchen-btn") { document.getElementById("kitchen-view").style.display = "block"; renderKitchenOrders(); }
      else { document.getElementById("tables-view").style.display = "block"; renderDynamicTables(); }
    });
  });

  document.getElementById("close-modal-btn").addEventListener("click", () => { document.getElementById("order-modal").classList.remove("show"); });
  
  document.getElementById("checkout-btn").addEventListener("click", async () => {
    if (currentCart.length === 0) return;
    const subtotal = parseFloat(document.getElementById("subtotal-price").innerText);
    const tableName = currentActiveTable ? currentActiveTable.number : "طاولة";
    
    try {
      await invoke("save_order", { tableNumber: tableName, totalPrice: subtotal });
      recordSaleToAnalytics(tableName, subtotal, currentCart);
      await printReceipt(tableName, subtotal, currentCart);
      sendOrderToKitchen(tableName, currentCart);
      if (currentActiveTable) { currentActiveTable.status = "occupied"; renderDynamicTables(); }
      document.getElementById("order-modal").classList.remove("show");
    } catch (e) { alert("خطأ الباك إند"); }
  });
});