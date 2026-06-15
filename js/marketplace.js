// ===== MARKETPLACE TITAN - LÓGICA ELITE =====
let mpProductos = [];
let mpVentas = [];
let mpProductoActual = null;
let mpEditandoId = null;

/**
 * Inicializa el módulo de Marketplace
 */
async function initMarketplace() {
    await refreshMarketplaceData();
}

/**
 * Carga datos desde Supabase
 */
async function refreshMarketplaceData() {
    try {
        // Traer productos
        const { data: prods, error: errP } = await supabase.from('productos').select('*').order('nombre');
        if (errP) throw errP;
        mpProductos = prods || [];

        // Traer ventas
        const { data: vts, error: errV } = await supabase.from('ventas').select('*').order('fecha', { ascending: false });
        if (errV) throw errV;
        mpVentas = vts || [];

        cargarProductosMP();
        actualizarStatsMP();
    } catch (error) {
        console.error('Error Marketplace:', error);
    }
}

/**
 * Renderiza las tarjetas de productos en el grid
 */
function cargarProductosMP() {
    const grid = document.getElementById('gridProductos');
    if(!grid) return;
    
    grid.innerHTML = mpProductos.map(p => {
        const bajoStock = p.stock <= p.stockMin;
        return `
        <div class="glass rounded-2xl p-5 card-hover relative group ${bajoStock ? 'ring-1 ring-yellow-500/50' : ''}">
            <div class="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition flex gap-1">
                <button onclick="editarProductoMP(${p.id})" class="w-7 h-7 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 flex items-center justify-center" title="Editar">
                    <i class="fas fa-edit text-[10px]"></i>
                </button>
            </div>
            ${bajoStock ? '<div class="absolute top-3 left-3 w-2 h-2 bg-yellow-500 rounded-full animate-pulse" title="Stock bajo"></div>' : ''}
            <div class="bg-gradient-to-br from-orange-500/20 to-yellow-500/20 h-28 rounded-xl mb-3 flex items-center justify-center relative overflow-hidden">
                <i class="fas fa-${p.categoria === 'Ropa' ? 'tshirt' : p.categoria === 'Suplementos' ? 'pills' : 'dumbbell'} text-3xl text-orange-500"></i>
                <div class="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 rounded text-[9px]">${p.sku}</div>
            </div>
            <h4 class="font-bold text-sm leading-tight">${p.nombre}</h4>
            <p class="text-[11px] text-gray-500">${p.marca}</p>
            <div class="flex items-center gap-2 mt-1">
                <span class="text-[10px] px-1.5 py-0.5 rounded ${p.stock > 10 ? 'bg-green-500/20 text-green-400' : p.stock > 0 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}">
                    Stock: ${p.stock}
                </span>
            </div>
            <div class="flex justify-between items-end mt-3">
                <div>
                    <span class="text-lg font-black">$${p.precio.toFixed(2)}</span>
                    <p class="text-[10px] text-green-400">+$${(p.precio - p.costo).toFixed(2)}</p>
                </div>
                <button onclick="abrirVentaMP(${p.id})" class="titan-gradient text-black px-3 py-1.5 rounded-lg text-xs font-bold hover:opacity-90 ${p.stock === 0 ? 'opacity-50 pointer-events-none' : ''}">
                    <i class="fas fa-shopping-cart mr-1"></i> Vender
                </button>
            </div>
        </div>`;
    }).join('');
}

/**
 * Actualiza los contadores de la parte superior
 */
function actualizarStatsMP() {
    const totalVentas = mpVentas.reduce((s, v) => s + v.total, 0);
    const vendidosCount = mpVentas.reduce((s, v) => s + v.cantidad, 0);
    
    const elVentas = document.getElementById('ventasMes');
    const elVendidos = document.getElementById('productosVendidos');
    const elComision = document.getElementById('comisionTotal');
    const elTotal = document.getElementById('totalProductos');
    
    if(elVentas) elVentas.textContent = '$' + totalVentas.toLocaleString();
    if(elVendidos) elVendidos.textContent = vendidosCount;
    if(elComision) elComision.textContent = '$' + (totalVentas * 0.15).toFixed(0);
    if(elTotal) elTotal.textContent = mpProductos.length;
}

/**
 * Prepara el modal para realizar una venta
 */
function abrirVentaMP(id) {
    mpProductoActual = mpProductos.find(p => p.id === id);
    if(!mpProductoActual || mpProductoActual.stock === 0) return;
    
    const modal = document.getElementById('modalVenta');
    if(modal) {
        modal.classList.remove('hidden');
        document.getElementById('ventaProductoInfo').innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center">
                    <i class="fas fa-${mpProductoActual.categoria === 'Ropa' ? 'tshirt' : 'pills'} text-orange-500"></i>
                </div>
                <div class="flex-1">
                    <p class="font-bold">${mpProductoActual.nombre}</p>
                    <p class="text-xs text-gray-400">En stock: ${mpProductoActual.stock} • $${mpProductoActual.precio} c/u</p>
                </div>
            </div>
        `;
        document.getElementById('ventaCantidad').value = 1;
        document.getElementById('ventaCantidad').max = mpProductoActual.stock;
        calcularTotalVenta();
    }
}

function cerrarModalVenta() {
    const modal = document.getElementById('modalVenta');
    if(modal) modal.classList.add('hidden');
    mpProductoActual = null;
}

function calcularTotalVenta() {
    if(!mpProductoActual) return;
    const cant = parseInt(document.getElementById('ventaCantidad').value) || 1;
    const desc = parseFloat(document.getElementById('ventaDescuento').value) || 0;
    const subtotal = mpProductoActual.precio * cant;
    const total = subtotal * (1 - desc/100);
    
    document.getElementById('ventaSubtotal').textContent = '$' + subtotal.toFixed(2);
    document.getElementById('ventaTotal').textContent = '$' + total.toFixed(2);
}

async function confirmarVenta() {
    if(!mpProductoActual) return;
    const cant = parseInt(document.getElementById('ventaCantidad').value);

    // Validación de integridad de datos
    if(isNaN(cant) || cant <= 0) {
        return alert('Por favor, ingrese una cantidad válida');
    }
    if(cant > mpProductoActual.stock) {
        return alert(`Error: Solo quedan ${mpProductoActual.stock} unidades en inventario`);
    }

    const total = parseFloat(document.getElementById('ventaTotal').textContent.replace('$', ''));
    
    const venta = {
        id: Date.now(),
        fecha: new Date().toISOString(),
        producto: mpProductoActual.nombre,
        cantidad: cant,
        total: total,
        cliente: document.getElementById('ventaCliente').value
    };

    // Bloquear el botón para evitar múltiples clics (Double-submit)
    const btnConfirmar = document.querySelector('button[onclick="confirmarVenta()"]');
    if(btnConfirmar) btnConfirmar.disabled = true;

    try {
        // 1. Registrar la venta
        const { error: errVenta } = await supabase.from('ventas').insert([venta]);
        if (errVenta) throw errVenta;

        // 2. Actualizar el stock
        const nuevoStock = mpProductoActual.stock - cant;
        const nuevasVentasTotales = (mpProductoActual.ventas_totales || 0) + cant;
        
        const { error: errStock } = await supabase
            .from('productos')
            .update({ stock: nuevoStock, ventas_totales: nuevasVentasTotales })
            .eq('id', mpProductoActual.id);
            
        if (errStock) throw errStock;

        cerrarModalVenta();
        await refreshMarketplaceData();
        alert('✅ Venta exitosa. Inventario actualizado.');
    } catch (error) {
        console.error('Marketplace Error:', error);
        alert('❌ Error crítico: La venta no se pudo procesar.');
    } finally {
        if(btnConfirmar) btnConfirmar.disabled = false;
    }
}

/**
 * Maneja la edición de productos
 */
function editarProductoMP(id) {
    const p = mpProductos.find(x => x.id === id);
    if(!p) return;
    
    mpEditandoId = id;
    document.getElementById('editorProducto').classList.remove('hidden');
    document.getElementById('prodNombre').value = p.nombre;
    document.getElementById('prodPrecio').value = p.precio;
    document.getElementById('prodStock').value = p.stock;
    // ... otros campos
}

/**
 * Hook para inicializar cuando se navega al Marketplace
 */
const _originalShowViewMP = window.showView;
window.showView = function(view) {
    if(typeof _originalShowViewMP === 'function') _originalShowViewMP(view);
    if(view === 'marketplace') {
        setTimeout(initMarketplace, 100);
    }
};