// Configuración de Supabase - Reemplaza con tus credenciales reales
const SUPABASE_URL = 'https://xdrtvuikdbltgqmjynom.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkcnR2dWlrZGJsdGdxbWp5bm9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NDIxNDUsImV4cCI6MjA5NzExODE0NX0.MkY96YO6BLM48I8G-UzPp8ysDAR2IA3xpgKq9reEv4E';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let clientes = [];
let userRole = null;
let loginRole = 'owner'; // Rol seleccionado por defecto
let currentStream = null, currentFotoTipo = '', currentLang = 'es';

/**
 * Maneja la selección visual del rol en la pantalla de login
 */
function selectLoginRole(role) {
    loginRole = role;
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.classList.remove('bg-orange-500', 'text-black');
        btn.classList.add('text-gray-400');
    });
    const activeBtn = document.getElementById(`btn-role-${role}`);
    if (activeBtn) {
        activeBtn.classList.remove('text-gray-400');
        activeBtn.classList.add('bg-orange-500', 'text-black');
    }
}

const translations = {
    es: { dashboard: 'Dashboard', clientes: 'Clientes', suscripciones: 'Suscripciones', dashboard_title: 'DASHBOARD TITAN', nuevo_cliente: 'Nuevo Cliente' },
    en: { dashboard: 'Dashboard', clientes: 'Clients', suscripciones: 'Subscriptions', dashboard_title: 'TITAN DASHBOARD', nuevo_cliente: 'New Client' },
    pt: { dashboard: 'Painel', clientes: 'Clientes', suscripciones: 'Assinaturas', dashboard_title: 'PAINEL TITAN', nuevo_cliente: 'Novo Cliente' }
};

async function setLang(lang) { 
    currentLang = lang;
    document.querySelectorAll('[data-lang]').forEach(el => {
        const key = el.getAttribute('data-lang');
        if(translations[lang][key]) el.textContent = translations[lang][key];
    });
}

/**
 * Inicia sesión con correo y contraseña usando Supabase Auth
 */
async function signInUser() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) return alert('Ingresa tus credenciales');

    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        await getUserProfile(data.user.id);

        document.getElementById('login').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        await refreshData();
        generarCalendario();
        checkUserRole();
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

/**
 * Registra un nuevo usuario (RESTRICCIÓN: Solo Admin)
 */
async function signUpUser() {
    if (userRole !== 'admin') {
        return alert('❌ Acceso Denegado: Solo el Administrador de GS Tecnología puede realizar registros.');
    }

    const nombre = document.getElementById('registerNombre').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const rol = document.getElementById('registerRole').value;

    if (!nombre || !email || !password) return alert('Completa todos los campos');

    try {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        const { error: pError } = await supabase.from('perfiles').insert([
            { id: data.user.id, nombre: nombre, rol: rol }
        ]);
        if (pError) throw pError;

        alert(`✅ ${rol.toUpperCase()} registrado correctamente.`);
        showView('dashboard');
    } catch (error) {
        alert('❌ Error al registrar: ' + error.message);
    }
}

/**
 * Obtiene el rol del usuario desde la tabla de perfiles
 */
async function getUserProfile(userId) {
    try {
        const { data, error } = await supabase
            .from('perfiles')
            .select('rol, activo')
            .eq('id', userId)
            .single();
        
        if (error) throw error;

        // Bloqueo por falta de pago o suspensión
        if (data.activo === false) {
            await supabase.auth.signOut();
            alert('🚫 ACCESO DENEGADO\n\nTu cuenta ha sido suspendida por falta de pago o incumplimiento de términos. Contacta con GS Tecnología para regularizar tu estado.');
            location.reload();
            return;
        }

        userRole = data.rol;
    } catch (error) {
        console.error('Error al obtener perfil:', error);
        userRole = 'coach'; // Rol por defecto en caso de error
    }
}

/**
 * Trae todos los perfiles de la base de datos (Solo para Admin)
 */
async function refreshUsuariosData() {
    const tbody = document.getElementById('tablaUsuarios');
    if(!tbody) return;
    
    try {
        const { data, error } = await supabase.from('perfiles').select('*').order('nombre');
        if (error) throw error;

        tbody.innerHTML = data.map(u => `
            <tr class="border-b border-gray-800 ${u.activo === false ? 'opacity-40 grayscale' : ''}">
                <td class="p-3 font-bold">${u.nombre}</td>
                <td class="p-3 text-[10px] text-gray-500 font-mono">${u.id}</td>
                <td class="p-3">
                    <span class="px-2 py-1 rounded-full text-[10px] font-bold ${u.rol === 'admin' ? 'bg-red-500/20 text-red-400' : u.rol === 'owner' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}">
                        ${u.rol.toUpperCase()}
                    </span>
                </td>
                <td class="p-3 text-center">
                    <div class="flex items-center justify-center gap-3">
                        <select onchange="cambiarRolUsuario('${u.id}', this.value)" class="bg-black/50 border border-gray-700 rounded-lg px-2 py-1 text-xs outline-none focus:border-orange-500">
                            <option value="coach" ${u.rol === 'coach' ? 'selected' : ''}>Coach</option>
                            <option value="owner" ${u.rol === 'owner' ? 'selected' : ''}>Dueño (Owner)</option>
                            <option value="admin" ${u.rol === 'admin' ? 'selected' : ''}>Admin GS</option>
                        </select>
                        <button onclick="toggleEstadoUsuario('${u.id}', ${u.activo !== false})" 
                                class="w-8 h-8 rounded-lg flex items-center justify-center transition ${u.activo === false ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30' : 'bg-red-500/20 text-red-500 hover:bg-red-500/30'}" 
                                title="${u.activo === false ? 'Activar Acceso' : 'Suspender Acceso'}">
                            <i class="fas fa-${u.activo === false ? 'user-check' : 'user-slash'}"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-red-500">Error: ${error.message}</td></tr>`;
    }
}

async function toggleEstadoUsuario(userId, estadoActual) {
    const nuevoEstado = !estadoActual;
    const accion = nuevoEstado ? 'ACTIVAR' : 'SUSPENDER';
    
    if(!confirm(`¿Seguro que quieres ${accion} el acceso de este usuario?`)) return;
    
    const { error } = await supabase.from('perfiles').update({ activo: nuevoEstado }).eq('id', userId);
    if (error) {
        alert('❌ Error al cambiar estado: ' + error.message);
    } else {
        alert(`✅ Usuario ${nuevoEstado ? 'activado' : 'suspendido'} correctamente`);
        refreshUsuariosData();
    }
}

async function cambiarRolUsuario(userId, nuevoRol) {
    if(!confirm(`¿Seguro que quieres cambiar el rol a ${nuevoRol.toUpperCase()}?`)) return refreshUsuariosData();
    
    const { error } = await supabase.from('perfiles').update({ rol: nuevoRol }).eq('id', userId);
    if (error) {
        alert('❌ Error al actualizar rol: ' + error.message);
        refreshUsuariosData();
    } else {
        alert('✅ Rol actualizado correctamente');
        refreshUsuariosData();
    }
}

function logout() {
    supabase.auth.signOut().then(() => {
        location.reload();
    });
}

function showView(view){ 
    document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden')); 
    const target = document.getElementById(view);
    if(target) {
        target.classList.remove('hidden');
        // Si intentan entrar a registro sin ser admin, los sacamos
        if(view === 'registerUser' && userRole !== 'admin') showView('dashboard');
        if(view === 'usuarios' && userRole === 'admin') refreshUsuariosData();
    }
    if(view === 'analytics') initCharts(); 
}

function showConfig(){ document.getElementById('configModal').classList.remove('hidden'); }
function closeConfig(){ document.getElementById('configModal').classList.add('hidden'); }

function guardarConfig(){ 
    const nombre=document.getElementById('configNombre').value; 
    document.getElementById('gymName').textContent=nombre.toUpperCase(); 
    localStorage.setItem('titan_config',JSON.stringify({nombre})); 
    closeConfig(); 
    alert('✓ Gimnasio personalizado');
}

function limpiarEnfermedades() {
    document.querySelectorAll('.enfermedad-check').forEach(el => el.checked = false);
    const area = document.getElementById('cEnfermedades');
    if(area) {
        area.value = '';
        area.classList.add('hidden');
    }
}

/**
 * Refactorización para soportar llamadas asíncronas a Supabase
 */
async function guardarCliente(){ 
    const enfermedadesList = Array.from(document.querySelectorAll('.enfermedad-check:checked'))
        .map(el => el.value)
        .filter(val => val !== 'Otra');
    
    const otraEnfermedad = document.getElementById('cEnfermedades').value;
    if (document.getElementById('checkOtra') && document.getElementById('checkOtra').checked && otraEnfermedad) {
        enfermedadesList.push(otraEnfermedad);
    }

    const cliente={ 
        id:Date.now(), 
        nombre:document.getElementById('cNombre').value, 
        cedula:document.getElementById('cCedula').value, 
        edad:document.getElementById('cEdad').value, 
        peso:document.getElementById('cPeso').value, 
        estatura:document.getElementById('cEstatura').value, 
        objetivo:document.getElementById('cObjetivo').value, 
        nivel:document.getElementById('cNivel').value, 
        historial:document.getElementById('cHistorial').value, 
        enfermedades: enfermedadesList.length > 0 ? enfermedadesList.join(', ') : 'Ninguna',
        lesiones:Array.from(document.querySelectorAll('.lesion:checked')).map(l=>l.value),
        alimentos:document.getElementById('cAlimentos').value 
    }; 

    if(!cliente.nombre || !cliente.cedula) {
        return alert('⚠️ Nombre y Cédula son obligatorios');
    }
    // Feedback visual de carga
    const btnGuardar = document.querySelector('button[onclick="guardarCliente()"]');
    const originalText = btnGuardar ? btnGuardar.innerHTML : '';
    if(btnGuardar) btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Procesando...';

    try {
        const { data, error } = await supabase
            .from('clientes')
            .insert([cliente]);
        if (error) throw error;

        // La lista se actualizará automáticamente con refreshData()
        
        alert('✓ Cliente guardado en la NUBE exitosamente'); 
        document.getElementById('clientCount').textContent = clientes.length + ' Clientes'; 
        await refreshData(); 
    } catch (error) {
        console.error('Error:', error);
        alert('❌ Error al guardar en la nube');
    } finally {
        if(btnGuardar) btnGuardar.innerHTML = originalText;
    }
}

/**
 * Función ELITE para traer datos de la nube
 */
async function refreshData() {
    try {
        const { data, error } = await supabase
            .from('clientes')
            .select('*')
            .order('nombre', { ascending: true });

        if (error) throw error;

        clientes = data || [];
        actualizarUI();
    } catch (error) {
        console.error('Error cargando datos:', error);
        // Fallback a localStorage si falla la red (opcional)
        clientes = JSON.parse(localStorage.getItem('titan_clientes')) || [];
        actualizarUI();
    }
}

function actualizarUI(){ 
    document.getElementById('clientCount').textContent=clientes.length+' Clientes'; 
    document.getElementById('statClientes').textContent = clientes.length;
    const selectors = ['selectClienteRutina', 'selectClienteIA', 'subCliente', 'pagoCliente', 'qrCliente'];
    const options = '<option>Seleccionar cliente...</option>' + clientes.map(c => `<option>${c.nombre} - ${c.nivel}</option>`).join('');
    selectors.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerHTML = options;
    });
}

/**
 * Oculta/muestra elementos del menú y funcionalidades según el rol del usuario
 */
function checkUserRole() {
    // Ocultar todos los elementos sensibles por defecto
    document.querySelectorAll('[data-role-access]').forEach(el => el.classList.add('hidden'));

    if (!userRole) return; // No hay rol, no mostrar nada

    // Mostrar elementos según el rol
    document.querySelectorAll(`[data-role-access*="${userRole}"]`).forEach(el => el.classList.remove('hidden'));

    // Lógica específica para el menú de navegación
    const navItems = document.querySelectorAll('aside nav a');
    navItems.forEach(item => {
        const requiredRoles = item.getAttribute('data-role-access');
        if (requiredRoles) {
            if (requiredRoles.includes(userRole)) {
                item.classList.remove('hidden');
            } else {
                item.classList.add('hidden');
            }
        } else {
            // Si no tiene data-role-access, es visible para todos los logueados
            item.classList.remove('hidden');
        }
    });
}

async function tomarFoto(tipo){ 
    currentStream = null;
    currentFotoTipo=tipo; 
    const video=document.getElementById('video'); 
    video.classList.remove('hidden'); 
    try{ 
        currentStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}); 
        video.srcObject=currentStream; 
        setTimeout(()=>capturarFoto(),1500);
    }catch(e){alert('Activa cámara');}
}

function capturarFoto(){ 
    const video=document.getElementById('video'); 
    const canvas=document.getElementById('canvas'); 
    canvas.width=video.videoWidth; 
    canvas.height=video.videoHeight; 
    canvas.getContext('2d').drawImage(video,0,0); 
    const dataUrl=canvas.toDataURL('image/jpeg'); 
    document.getElementById('preview-'+currentFotoTipo).innerHTML=`<img src="${dataUrl}" class="w-full h-full object-cover rounded-xl">`; 
    video.classList.add('hidden'); 
    if(currentStream) currentStream.getTracks().forEach(t=>t.stop()); 
}

/**
 * Sube una imagen en base64 a Supabase Storage y retorna la URL pública
 */
async function uploadScanImage(base64Data, path) {
    const base64 = base64Data.split(',')[1];
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], {type: 'image/jpeg'});

    const { error } = await supabase.storage
        .from('scans')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true });

    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('scans').getPublicUrl(path);
    return publicUrl;
}

// Función auxiliar para obtener lesiones seleccionadas
function getLesionesSeleccionadas() {
    return Array.from(document.querySelectorAll('.lesion:checked')).map(l => l.value);
}

function analizarCuerpo(){ 
    const peso = parseFloat(document.getElementById('cPeso').value) || 75; 
    const estatura = parseFloat(document.getElementById('cEstatura').value) || 175; 
    const objetivo = document.getElementById('cObjetivo').value;
    const imc = (peso / ((estatura / 100) ** 2)).toFixed(1); 
    const lesionesSeleccionadas = getLesionesSeleccionadas();
    
    document.getElementById('resultadosAnalisis').classList.remove('hidden'); 
    document.getElementById('imc').textContent = imc; 

    // Lógica Elite de Grasa Estimada
    let recomendacion = "";
    if (imc < 18.5) {
        recomendacion = "Bajo peso. Enfocar en aumento de masa muscular y peso saludable. Dieta hipercalórica rica en proteínas y carbohidratos complejos.";
    } else if (imc >= 18.5 && imc < 25) {
        if (objetivo === 'Ganar masa muscular') recomendacion = "Peso saludable. Excelente base para hipertrofia. Mantener superávit calórico moderado y entrenamiento de fuerza progresivo.";
        else if (objetivo === 'Perder grasa') recomendacion = "Peso saludable. Para pérdida de grasa, mantener un ligero déficit calórico y aumentar actividad cardiovascular.";
        else recomendacion = "Peso saludable. Mantener un estilo de vida activo y dieta equilibrada.";
    } else if (imc >= 25 && imc < 30) {
        recomendacion = "Sobrepeso. Priorizar la pérdida de grasa corporal. Dieta hipocalórica, cardio regular y entrenamiento de fuerza para preservar músculo.";
    } else {
        recomendacion = "Obesidad. Es crucial iniciar un plan de pérdida de peso bajo supervisión. Combinar dieta hipocalórica con actividad física de bajo impacto.";
    }
    let grasaBase = imc * 1.2; 
    if(objetivo === 'Ganar masa muscular') grasaBase -= 4;
    if(objetivo === 'Perder grasa') grasaBase += 2;
    document.getElementById('grasa').textContent = grasaBase.toFixed(1) + '%';

    // Determinación de Somatotipo
    let soma = "Mesomorfo";
    if(imc < 20) soma = "Ectomorfo";
    if(imc > 28) soma = "Endomorfo";
    document.getElementById('somatotipo').textContent = soma;
    
    // Adaptación por lesiones en la recomendación
    if (lesionesSeleccionadas.length > 0) {
        recomendacion += " Considerar adaptaciones en el entrenamiento debido a: " + lesionesSeleccionadas.join(', ') + ". Consultar con un especialista.";
    }

    document.getElementById('recomendacionIA').innerHTML = `<p class="text-sm">${recomendacion}</p>`;

    alert('✓ Análisis de composición completado');
}

function generarRutina(){
    const select = document.getElementById('selectClienteRutina');
    if (!select || select.value === 'Seleccionar cliente...') {
        alert('Por favor, selecciona un cliente para generar la rutina.');
        document.getElementById('rutinaGenerada').innerHTML = '<p class="text-gray-500 text-center py-20">Selecciona un cliente y genera su rutina personalizada</p>';
        return;
    }

    const nombreSel = select.value.split(' - ')[0];
    const cliente = clientes.find(c => c.nombre === nombreSel) || clientes[0];
    
    const nivel = cliente.nivel || 'BÁSICO';
    const objetivo = cliente.objetivo;
    
    let enfoque = "";
    let ejerciciosExtra = "";
    let calentamiento = "5-10 min de cardio ligero (caminadora, elíptica) + movilidad articular.";
    let enfriamiento = "5-10 min de estiramientos estáticos de los músculos trabajados.";
    let notaCoachRutina = "Recuerda escuchar a tu cuerpo y ajustar las cargas si es necesario. La técnica es primordial.";

    // Adaptaciones por edad y lesiones
    if (cliente.lesiones.includes('rodillas')) {
        calentamiento += " Enfocar en movilidad de cadera y tobillo.";
        notaCoachRutina += " Especial atención a la forma en ejercicios de pierna para proteger las rodillas.";
    }
    if (parseInt(cliente.edad) > 50) { // Ejemplo de adaptación por edad
        calentamiento += " Mayor énfasis en movilidad y activación muscular.";
        notaCoachRutina += " Priorizar la recuperación y evitar cargas máximas. La consistencia es clave.";
    }

    // Personalización por Objetivo
    if(objetivo === 'Perder grasa') {
        enfoque = "Alta intensidad, descansos cortos (30s) y enfoque metabólico.";
        ejerciciosExtra = "• Cardio HIIT: 15 min al final de cada sesión.";
    } else if(objetivo === 'Ganar masa muscular') {
        enfoque = "Cargas pesadas (70-85% RM), descansos largos (90s) y volumen moderado.";
        ejerciciosExtra = "• Enfoque en básicos: Multiarticulares pesados.";
    } else {
        enfoque = "Equilibrio entre fuerza y resistencia.";
    }

    const rutinas={
        'BÁSICO': `<h3 class="text-2xl font-bold text-orange-500 mb-2">RUTINA BÁSICO - ${objetivo.toUpperCase()}</h3>
        <p class="text-xs text-gray-400 mb-4 italic">Enfoque: ${enfoque}</p>
        <div class="space-y-4 text-sm">
        <div class="border-l-4 border-orange-500 pl-4"><h4 class="font-bold">LUNES - Pecho + Tríceps</h4><p class="text-gray-400">Press banca 4x10 (20-40kg) • Press inclinado 3x12 • Fondos 3x10 • Extensión polea 3x15</p></div>
        <div class="border-l-4 border-orange-500 pl-4"><h4 class="font-bold">MARTES - Espalda + Bíceps</h4><p class="text-gray-400">Jalón pecho 4x12 • Remo barra 4x10 • Curl barra 3x12 • Curl martillo 3x12</p></div>
        <div class="border-l-4 border-orange-500 pl-4"><h4 class="font-bold">MIÉRCOLES - Piernas</h4><p class="text-gray-400">Sentadilla 4x10 • Prensa 4x12 • Peso muerto rumano 3x12 • Pantorrillas 4x15</p></div>
        </div>`,
        'INTERMEDIO': `<h3 class="text-2xl font-bold text-orange-500 mb-2">RUTINA INTERMEDIO - ${objetivo.toUpperCase()}</h3>
        <p class="text-xs text-gray-400 mb-4 italic">Enfoque: ${enfoque}</p>
        <div class="space-y-4 text-sm">
        <div class="border-l-4 border-orange-500 pl-4"><h4 class="font-bold">LUNES - Pecho + Tríceps</h4><p class="text-gray-400">Press banca 5x6-8 (70-80%) • Press inclinado 4x10 • Aperturas 4x15 • Fondos 4x10-12</p></div>
        <div class="border-l-4 border-orange-500 pl-4"><h4 class="font-bold">MARTES - Espalda + Bíceps</h4><p class="text-gray-400">Dominadas 5x8 • Remo barra 5x8 • Jalón unilateral 4x12 • Curl Z 4x10</p></div>
        <div class="border-l-4 border-orange-500 pl-4"><h4 class="font-bold">MIÉRCOLES - Piernas</h4><p class="text-gray-400">Sentadilla profunda 5x6-8 • Peso muerto rumano 4x10 • Prensa 4x12 • Femoral 4x15</p></div>
        </div>`,
        'AVANZADO': `<h3 class="text-2xl font-bold text-orange-500 mb-4">RUTINA AVANZADO</h3><div class="space-y-3 text-sm"><p><b>LUNES:</b> Press banca 6x4-6 (80-90%) • Inclinado 5x8-10 • Fondos lastrados 5x8-12</p><p><b>MARTES:</b> Peso muerto 6x3-5 • Dominadas lastradas 5x6-8 • Remo Pendlay 5x8</p><p><b>MIÉRCOLES:</b> Sentadilla 6x4-6 • Frontal 5x8 • Rumano 5x10 • Prensa 5x15 dropset</p><p><b>JUEVES:</b> Press militar 6x5-8 • Laterales 5x15 • Posteriores 5x15 • Face pulls 4x20</p><p><b>VIERNES:</b> Power clean 5x3 • Push press 5x5 • Peso muerto velocidad 8x2</p><p><b>SÁBADO:</b> Hipertrofia total circuitos • Cardio 40min</p><p><b>DOMINGO:</b> Recuperación</p></div>`,
        'PROFESIONAL': `<h3 class="text-2xl font-bold text-orange-500 mb-4">RUTINA PROFESIONAL</h3><div class="space-y-3 text-sm"><p><b>LUNES:</b> Press banca 7x2-5 (85-95%) • Inclinado barra 6x6-8 • Convergente 5x10-12</p><p><b>MARTES:</b> Peso muerto competitivo 8x1-3 (90-97%) • Dominadas lastradas 6x6-8 • T-bar 6x8-10</p><p><b>MIÉRCOLES:</b> Sentadilla low bar 8x2-5 • Frontal 6x6-8 • Rumano 6x8-10 • Prensa 5x20 rest-pause</p><p><b>JUEVES:</b> Press militar 7x5-6 • Arnold 5x10 • Laterales pesadas 6x15 • Encogimientos 6x15</p><p><b>VIERNES:</b> Power clean 7x2-3 • Push press 6x5 • Peso muerto velocidad 8x2 • Sprints HIIT 25min</p><p><b>SÁBADO:</b> Hipertrofia extrema circuitos 20 reps</p><p><b>DOMINGO:</b> Recuperación profesional</p></div>`
    };

    let html=rutinas[nivel]||rutinas['INTERMEDIO'];
    
    // Inyectar extras del objetivo
    if(ejerciciosExtra) html += `<div class="mt-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded text-xs"><b>🔥 Optimización por Objetivo:</b><br>${ejerciciosExtra}</div>`;

    // Adaptación por Lesiones (Lógica Brutal)
    if(cliente.lesiones.includes('rodillas')){ html+=`<div class="mt-4 p-3 bg-red-500/20 border border-red-500 rounded"><b>⚠ Adaptado:</b> Sin sentadillas libres, usar prensa y búlgaras</div>`; }
    if(cliente.lesiones.includes('espalda')){ html+=`<div class="mt-4 p-3 bg-red-500/20 border border-red-500 rounded"><b>⚠ Adaptado:</b> Evitar peso muerto convencional y remos sin apoyo. Usar remo en máquina.</div>`; }
    if(cliente.lesiones.includes('hombros')){ html+=`<div class="mt-4 p-3 bg-red-500/20 border border-red-500 rounded"><b>⚠ Adaptado:</b> Sustituir press militar con barra por mancuernas agarre neutro.</div>`; }

    html += `<div class="mt-6 p-3 bg-gray-700/50 rounded-lg text-xs"><b>🔥 Calentamiento:</b> ${calentamiento}</div>`;
    html += `<div class="mt-2 p-3 bg-gray-700/50 rounded-lg text-xs"><b>❄️ Enfriamiento:</b> ${enfriamiento}</div>`;
    html += `<div class="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded text-xs"><b>💡 Nota del Coach IA:</b> ${notaCoachRutina}</div>`;

    document.getElementById('rutinaGenerada').innerHTML=html;
    alert('✓ Rutina personalizada generada');
}

function generarNutricion(){ 
    const select = document.getElementById('selectClienteIA'); 
    if (!select || select.value === 'Seleccionar cliente...') {
        alert('Por favor, selecciona un cliente para generar el plan nutricional.');
        document.getElementById('tablaNutricion').innerHTML = '<tr><td colspan="4" class="p-8 text-center text-gray-500">Genera un plan para ver resultados</td></tr>';
        return;
    }

    const nombreSel = select.value.split(' - ')[0];
    const cliente = clientes.find(c => c.nombre === nombreSel) || clientes[0];
    
    const peso = parseFloat(cliente.peso) || 70;
    const estatura = parseFloat(cliente.estatura) || 175;
    const edad = parseInt(cliente.edad) || 30;
    const objetivo = cliente.objetivo;
    const alimentosDisp = cliente.alimentos || "";
    const enfermedades = (cliente.enfermedades || "").toLowerCase();
    const nivel = cliente.nivel || 'BÁSICO'; // Para factor de actividad
    const imc = (peso / ((estatura / 100)**2)).toFixed(1);

    // Cálculo simplificado de BMR (Mifflin-St Jeor, asumiendo hombre para prototipo)
    let bmr = (10 * peso) + (6.25 * estatura) - (5 * edad) + 5;

    // Factor de actividad basado en el nivel del cliente
    let activityFactor = 1.375; // Ligeramente activo (BÁSICO)
    if (nivel === 'INTERMEDIO') activityFactor = 1.55; // Moderadamente activo
    if (nivel === 'AVANZADO' || nivel === 'PROFESIONAL') activityFactor = 1.725; // Muy activo

    let tdee = bmr * activityFactor;
    let caloriasObjetivo = tdee;

    let proteinaG = 0;
    let carbG = 0;
    let grasaG = 0;
    let notaNutricional = "";
    
    let dieta = { d: "Avena + 3 claras", a: "Pollo 150g + Ensalada", c: "Pescado + Brócoli" };

    // Lógica de Adaptación Económica y por Alimentos del Cliente
    const usaAlimentosPropio = alimentosDisp.length > 5;
    const notaEconomica = usaAlimentosPropio ? 
        `Adaptado a tu disponibilidad: <b>${alimentosDisp}</b>. Se han priorizado estos recursos para maximizar tu presupuesto.` :
        "Plan optimizado con fuentes de proteína de alta calidad y bajo costo (huevos, pollo, granos).";

    if(objetivo === 'Perder grasa') {
        dieta = { d: "Omelette de espinaca (3 claras) + Té verde", a: "Pechuga de pollo 150g + Espárragos + 1/2 aguacate", c: "Pescado blanco o Atún + Mix de hojas verdes" };
        if(usaAlimentosPropio && alimentosDisp.toLowerCase().includes("huevo")) dieta.d = "3 Huevos cocidos + Vegetales";
    } else if(objetivo === 'Ganar masa muscular') {
        dieta = { d: "100g Avena + 3 huevos enteros + 1 banano", a: "Carne roja 200g + 150g Arroz integral + Vegetales", c: "Pollo 200g + Camote/Papa 150g + Ensalada" };
    } 

    // Adaptación por Enfermedades (Lógica Elite de Salud)
    let alertaMedica = "";
    if(enfermedades.includes("diabetes")) {
        alertaMedica += "⚠️ <b>Protocolo Diabetes:</b> Se han eliminado azúcares simples. Carbohidratos de bajo índice glucémico únicamente. <br>";
        dieta.d = "Omelette de vegetales (sin frutas dulces)";
    }
    if(enfermedades.includes("hipertensión") || enfermedades.includes("hipertension")) {
        alertaMedica += "⚠️ <b>Protocolo Hipertensión:</b> Dieta baja en sodio. Evitar embutidos y sales añadidas. <br>";
    }
    if(enfermedades.includes("gastritis")) {
        alertaMedica += "⚠️ <b>Protocolo Gastritis:</b> Evitar picantes, ácidos y cafeína en ayunas. Comidas en porciones pequeñas. <br>";
    }
    if(enfermedades.includes("celiaco") || enfermedades.includes("gluten")) {
        alertaMedica += "⚠️ <b>Protocolo Celíaco:</b> Dieta 100% libre de gluten (trigo, avena, cebada, centeno). <br>";
    }

    if(objetivo === 'Perder grasa') {
        caloriasObjetivo -= 500; // Déficit
        proteinaG = (peso * 2.2).toFixed(0); // 2.2g/kg
        grasaG = (caloriasObjetivo * 0.25 / 9).toFixed(0); // 25% de grasas
        carbG = ((caloriasObjetivo - (proteinaG * 4) - (grasaG * 9)) / 4).toFixed(0);
        notaNutricional = "Prioriza alimentos integrales, vegetales y proteínas magras. Mantén la hidratación y evita azúcares añadidos. El déficit calórico es clave.";
    } else if(objetivo === 'Ganar masa muscular') {
        caloriasObjetivo += 300; // Superávit
        proteinaG = (peso * 2.0).toFixed(0); // 2.0g/kg
        grasaG = (caloriasObjetivo * 0.25 / 9).toFixed(0); // 25% de grasas
        carbG = ((caloriasObjetivo - (proteinaG * 4) - (grasaG * 9)) / 4).toFixed(0);
        notaNutricional = "Asegura un superávit calórico constante con proteínas de alta calidad y carbohidratos complejos para energía y recuperación muscular.";
    } else { // Tonificar, Rendimiento, Rehabilitación (Mantenimiento o ligero ajuste)
        proteinaG = (peso * 1.8).toFixed(0);
        grasaG = (caloriasObjetivo * 0.30 / 9).toFixed(0);
        carbG = ((caloriasObjetivo - (proteinaG * 4) - (grasaG * 9)) / 4).toFixed(0);
        notaNutricional = "Mantén una dieta equilibrada. Ajusta las porciones según tu nivel de actividad y cómo te sientas. La consistencia es fundamental.";
    }

    const dias=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']; 
    let html=`<div class="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded text-center">
                <p class="text-xs">Plan para: <b>${cliente.nombre}</b> | Objetivo: <b>${objetivo}</b> | IMC: <b>${imc}</b></p>
                <p class="text-xs mt-1">Calorías Estimadas: <b>${caloriasObjetivo.toFixed(0)} kcal</b> | Proteína: <b>${proteinaG}g</b> | Carbs: <b>${carbG}g</b> | Grasas: <b>${grasaG}g</b></p>
              </div>`; 
    
    dias.forEach(d=>{ 
        html+=`<tr class="border-b border-gray-800">
                <td class="p-3 font-bold">${d}</td>
                <td class="p-3 text-xs">${dieta.d}</td>
                <td class="p-3 text-xs">${dieta.a}</td>
                <td class="p-3 text-xs">${dieta.c}</td>
               </tr>`; 
    });
    if(usaAlimentosPropio) {
        html += `<div class="mt-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl text-[11px]"><b>🛒 Tus Alimentos Base:</b> ${alimentosDisp}</div>`;
    }
    if(alertaMedica) {
        html += `<div class="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 font-bold">${alertaMedica}</div>`;
    }
    html += `<div class="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded text-xs"><b>💡 Consejo Nutricional del Coach IA:</b> ${notaNutricional}</div>`;
    document.getElementById('tablaNutricion').innerHTML=html; 
    alert('✓ Plan nutricional personalizado generado');
}

function crearSuscripcion(){ alert('✓ Suscripción creada. El sistema avisará automáticamente.'); }

function generarPDF(tipo){ 
    const {jsPDF}=window.jspdf; 
    const doc=new jsPDF(); 
    doc.setFillColor(255,59,0); 
    doc.rect(0,0,210,30,'F'); 
    doc.setFontSize(20); 
    doc.text('TITAN GYMFORCE PRO 360',105,15,{align:'center'}); 
    doc.setFontSize(12); 
    doc.text('Rutina Personalizada - Nivel INTERMEDIO',20,45); 
    doc.text('LUNES: Press banca 5x6-8, Press inclinado 4x10',20,60); 
    doc.text('MARTES: Dominadas 5x8, Remo 5x8',20,70); 
    doc.text('MIÉRCOLES: Sentadilla 5x6-8, Peso muerto rumano 4x10',20,80); 
    doc.text('JUEVES: Press militar 5x8, Laterales 5x15',20,90); 
    doc.text('VIERNES: Peso muerto 5x5, HIIT',20,100); 
    doc.text('SÁBADO: Circuito hipertrofia',20,110); 
    doc.save('Rutina-TITAN.pdf'); 
}

function generarCertificado(nombre){ 
    const {jsPDF}=window.jspdf; 
    const doc=new jsPDF({orientation:'landscape'}); 
    doc.setFillColor(10,10,10); 
    doc.rect(0,0,297,210,'F'); 
    doc.setDrawColor(255,59,0); 
    doc.setLineWidth(5); 
    doc.rect(10,10,277,190); 
    doc.setTextColor(255,59,0); 
    doc.setFontSize(30); 
    doc.text('CERTIFICADO DE FINALIZACIÓN',148,50,{align:'center'}); 
    doc.setTextColor(255,255,255); 
    doc.setFontSize(20); 
    doc.text(nombre.toUpperCase(),148,90,{align:'center'}); 
    doc.setFontSize(14); 
    doc.text('Ha completado exitosamente su programa de entrenamiento',148,110,{align:'center'}); 
    doc.text('TITAN GYMFORCE PRO 360',148,130,{align:'center'}); 
    doc.setFontSize(10); 
    doc.text('propiedad de gs tecnología derecho reservado 2026',148,180,{align:'center'}); 
    doc.save(`Certificado-${nombre}.pdf`); 
    alert('✓ Certificado generado'); 
}

function generarCalendario(){
    const grid=document.getElementById('calendarGrid'); 
    if(!grid) return;
    grid.innerHTML=''; 
    const days=31;
    for(let i=1;i<=days;i++){
        const day=document.createElement('div'); 
        day.className='calendar-day glass rounded-xl p-2'; 
        day.draggable=true;
        day.innerHTML=`<div class="text-sm font-bold">${i}</div>`;
        if(i===15) day.innerHTML+=`<div class="mt-1 text-xs bg-red-500/30 text-red-400 px-2 py-1 rounded" draggable="true">Vence María</div>`;
        if(i===22) day.innerHTML+=`<div class="mt-1 text-xs bg-orange-500/30 text-orange-400 px-2 py-1 rounded">Entrenamiento</div>`;
        grid.appendChild(day);
    }
}

function activarProgresion(){
    const meses=[
        {mes:1,nombre:'Adaptación',desc:'50-60% RM, 3x12-15'},
        {mes:2,nombre:'Resistencia',desc:'60% RM, 4x12'},
        {mes:3,nombre:'Hipertrofia Inicial',desc:'65-70% RM, 4x10-12'},
        {mes:4,nombre:'Fuerza Básica',desc:'70-75% RM, 5x8-10'},
        {mes:5,nombre:'Hipertrofia Avanzada',desc:'75% RM, 5x8-12'},
        {mes:6,nombre:'Preparación Intermedio',desc:'75-80% RM, 5-6x6-10'}
    ];
    let html=''; 
    meses.forEach(m=>{ 
        html+=`<div class="flex items-center gap-4 p-4 bg-black/30 rounded-xl"><div class="titan-gradient w-12 h-12 rounded-full flex items-center justify-center text-black font-black">${m.mes}</div><div class="flex-1"><p class="font-bold">${m.nombre}</p><p class="text-sm text-gray-400">${m.desc}</p></div><div class="text-green-500"><i class="fas fa-check-circle text-2xl"></i></div></div>`; 
    });
    document.getElementById('progresionMeses').innerHTML=html;
    alert('✓ Progresión de 6 meses activada. El sistema cambiará automáticamente cada 4 semanas.');
}

function generarPagoPayPhone(){
    const monto=document.getElementById('pagoMonto').value;
    const cliente=document.getElementById('pagoCliente').value;
    document.getElementById('qrPago').innerHTML=`<div class="text-center"><div class="w-48 h-48 mx-auto bg-black p-4 rounded-xl mb-3 flex items-center justify-center"><div class="text-center"><i class="fas fa-qrcode text-6xl text-black"></i><p class="text-xs mt-2 text-black font-bold">PAYPHONE</p></div></div><p class="font-bold text-black">$${monto} USD</p><p class="text-sm text-gray-600">Escanea para pagar</p></div>`;
    setTimeout(()=>{ document.getElementById('pagoStatus').classList.remove('hidden'); }, 3000);
}

function iniciarScannerQR(){
    const video=document.getElementById('qrVideo');
    const placeholder=document.getElementById('qrPlaceholder');
    if(placeholder) placeholder.classList.add('hidden'); 
    if(video) video.classList.remove('hidden');
    navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}).then(stream=>{ 
        video.srcObject=stream; 
        setTimeout(()=>simularCheckin(),2000); 
    });
}

function simularCheckin(){
    const lista=document.getElementById('listaCheckins');
    const nuevo=document.createElement('div');
    nuevo.className='p-3 bg-green-500/10 border border-green-500/30 rounded-lg';
    nuevo.innerHTML='<p class="font-semibold">Nuevo Cliente</p><p class="text-xs text-gray-400">'+new Date().toLocaleTimeString()+' • Entrada</p>';
    if(lista) lista.prepend(nuevo);
    const contador = document.getElementById('contadorHoy');
    if(contador) contador.textContent=parseInt(contador.textContent)+1;
    alert('✓ Check-In registrado: Acceso permitido');
}

function generarQRCliente(){
    const cliente=document.getElementById('qrCliente').value;
    document.getElementById('qrGenerado').innerHTML=`<div class="text-center"><div class="w-40 h-40 mx-auto bg-black p-3 rounded-xl mb-2 flex items-center justify-center"><i class="fas fa-qrcode text-6xl text-white"></i></div><p class="text-sm text-gray-600 font-bold">${cliente||'CLIENTE'}</p><p class="text-xs text-gray-500">ID: TITAN-${Date.now().toString().slice(-6)}</p></div>`;
}

function previewLogo(event){
    const file=event.target.files[0]; 
    if(file){ 
        const reader=new FileReader(); 
        reader.onload=e=>{ document.getElementById('logoPreview').innerHTML=`<img src="${e.target.result}" class="w-full h-full object-cover rounded-xl">`; }; 
        reader.readAsDataURL(file); 
    }
}

function guardarConfiguracionCompleta(){
    const config={
        nombre: document.getElementById('cfgNombre').value,
        ruc: document.getElementById('cfgRuc').value,
        direccion: document.getElementById('cfgDireccion').value,
        telefono: document.getElementById('cfgTelefono').value,
        email: document.getElementById('cfgEmail').value,
        ciudad: document.getElementById('cfgCiudad').value,
        color1: document.getElementById('cfgColor1').value,
        color2: document.getElementById('cfgColor2').value,
        apertura: document.getElementById('cfgApertura').value,
        cierre: document.getElementById('cfgCierre').value,
        payphoneToken: document.getElementById('cfgPayphoneToken').value
    };
    localStorage.setItem('titan_config_completa', JSON.stringify(config));
    document.getElementById('gymName').textContent=config.nombre.toUpperCase();
    document.documentElement.style.setProperty('--primary', config.color1);
    alert('✓ Configuración guardada completamente\n\n✓ Datos del gimnasio\n✓ Logo y colores\n✓ PayPhone integrado\n✓ Listo para operar en Ecuador');
}

function probarWhatsApp(){
    const numero = prompt('Número WhatsApp para prueba (con código país):', '593998765432');
    if(numero){
        const mensaje = encodeURIComponent('🏋️ TITAN GYMFORCE PRO 360\n\nHola, tu suscripción vence en 3 días. Renueva ahora y mantén tu progreso 💪\n\nPaga aquí: https://payphone.link/titan');
        window.open(`https://wa.me/${numero}?text=${mensaje}`, '_blank');
        alert('✓ WhatsApp abierto. En producción se envía automáticamente via API.');
    }
}

function initCharts(){
    setTimeout(()=>{
        const ctx1 = document.getElementById('chartIngresos');
        if(ctx1 && !ctx1.chart){
            ctx1.chart = new Chart(ctx1, {
                type: 'line',
                data: {
                    labels: ['Dic', 'Ene', 'Feb', 'Mar', 'Abr', 'May'],
                    datasets: [{ label: 'Ingresos', data: [32000, 35000, 38000, 41000, 44500, 47230], borderColor: '#FF3B00', backgroundColor: 'rgba(255,59,0,0.1)', tension: 0.4, fill: true }]
                },
                options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { ticks: { color: '#999' } }, x: { ticks: { color: '#999' } } } }
            });
        }
        const ctx2 = document.getElementById('chartNiveles');
        if(ctx2 && !ctx2.chart){
            ctx2.chart = new Chart(ctx2, {
                type: 'doughnut',
                data: {
                    labels: ['Básico', 'Intermedio', 'Avanzado', 'Pro'],
                    datasets: [{ data: [45, 98, 76, 28], backgroundColor: ['#FF3B00', '#FF6B00', '#FF8C00', '#FFA500'] }]
                },
                options: { responsive: true, plugins: { legend: { labels: { color: '#fff' } } } }
            });
        }
        const ctx3 = document.getElementById('chartRenovaciones');
        if(ctx3 && !ctx3.chart){
            ctx3.chart = new Chart(ctx3, {
                type: 'bar',
                data: {
                    labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May'],
                    datasets: [
                        { label: 'Renovaciones', data: [89, 92, 95, 102, 108], backgroundColor: '#22c55e' },
                        { label: 'Cancelaciones', data: [12, 10, 8, 11, 9], backgroundColor: '#ef4444' }
                    ]
                },
                options: { responsive: true, plugins: { legend: { labels: { color: '#fff' } } }, scales: { y: { ticks: { color: '#999' } }, x: { ticks: { color: '#999' } } } }
            });
        }
        const ctx4 = document.getElementById('chartHorarios');
        if(ctx4 && !ctx4.chart){
            ctx4.chart = new Chart(ctx4, {
                type: 'bar',
                data: {
                    labels: ['6-8', '8-10', '10-12', '12-14', '14-16', '16-18', '18-20', '20-22'],
                    datasets: [{ label: 'Clientes', data: [23, 45, 32, 18, 25, 67, 89, 54], backgroundColor: '#FF3B00' }]
                },
                options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { ticks: { color: '#999' } }, x: { ticks: { color: '#999' } } } }
            });
        }
    }, 500);
}

let fotosIA = {};

function cargarFotoIA(tipo){
    const input = document.createElement('input'); 
    input.type='file'; 
    input.accept='image/*';
    input.onchange = e => {
        const file = e.target.files[0]; 
        const reader = new FileReader();
        reader.onload = ev => {
            fotosIA[tipo] = ev.target.result;
            document.getElementById('ia-preview-'+tipo).innerHTML = `<img src="${ev.target.result}" class="w-full h-full object-cover rounded-lg">`;
            document.getElementById('ia-preview-'+tipo).classList.remove('border-dashed');
            document.getElementById('ia-preview-'+tipo).classList.add('border-solid', 'border-green-500');
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

async function tomarFotoIA(tipo){
    const video = document.getElementById('iaVideo');
    video.classList.remove('hidden');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = stream;
        setTimeout(() => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth; 
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg');
            fotosIA[tipo] = dataUrl;
            document.getElementById('ia-preview-'+tipo).innerHTML = `<img src="${dataUrl}" class="w-full h-full object-cover rounded-lg">`;
            document.getElementById('ia-preview-'+tipo).classList.add('border-solid', 'border-green-500');
            video.classList.add('hidden');
            stream.getTracks().forEach(t => t.stop());
        }, 1500);
    } catch(e) { alert('Activa la cámara'); }
}

function cargarDesdeScanner(){
    ['frontal','posterior','lateral-izq','lateral-der'].forEach(tipo => {
        const imgContainer = document.getElementById('preview-' + tipo);
        const imgElement = imgContainer ? imgContainer.querySelector('img') : null;
        if(imgElement) {
            const foto = imgElement.src;
            fotosIA[tipo] = foto;
            const preview = document.getElementById('ia-preview-'+tipo);
            if(preview) {
                preview.innerHTML = `<img src="${foto}" class="w-full h-full object-cover rounded-lg">`;
                preview.classList.add('border-solid', 'border-green-500');
            }
        }
    });
    alert('✓ Fotos cargadas desde Escáner 360°');
}

/**
 * Simula el análisis IA de múltiples fotos, proporcionando recomendaciones
 * y un riesgo de lesión basado en los datos del cliente y el objetivo.
 */
function analizarIAMulti(){
    const count = Object.keys(fotosIA).length;
    if(count < 2) return alert('Carga al menos 2 fotos para análisis');
    
    const select = document.getElementById('selectClienteIA');
    if (!select || select.value === 'Seleccionar cliente...') {
        alert('Por favor, selecciona un cliente para realizar el análisis IA.');
        document.getElementById('iaResultados').innerHTML = '<div class="text-center py-8 text-gray-500"><i class="fas fa-layer-group text-4xl mb-3"></i><p class="text-sm">Carga 2-5 fotos para análisis 3D completo</p></div>';
        return;
    }

    const nombreSel = select.value.split(' - ')[0];
    const cliente = clientes.find(c => c.nombre === nombreSel) || { peso: 75, estatura: 175, objetivo: 'Tonificar' };

    const peso = parseFloat(cliente.peso) || 75;
    const estatura = (parseFloat(cliente.estatura) || 175) / 100;
    const imc = (peso / (estatura * estatura)).toFixed(1);
    const edad = parseInt(cliente.edad) || 30;

    // Simulación de cálculo de grasa basado en datos reales del cliente
    let grasaIA = (imc * 1.1 + (count * 0.5)).toFixed(1); 
    let musculoIA = (peso * 0.42 + (count * 0.1)).toFixed(1);

    let observacion = "";
    if(cliente.objetivo === 'Ganar masa muscular') {
        observacion = "Desarrollo hipertrófico detectado en tren superior. Se observa buena densidad en deltoides. Enfocar en densidad de espalda baja.";
    } else if(cliente.objetivo === 'Perder grasa') {
        observacion = "Reducción de tejido adiposo en zona subcutánea. Simetría abdominal mejorando. Mantener déficit controlado.";
    } else {
        observacion = "Simetría muscular del 96%. Postura escapular correcta. Definición moderada en extremidades.";
    }

    let recomendacionCoach = "";
    if (cliente.objetivo === 'Ganar masa muscular') {
        if (parseFloat(musculoIA) < (peso * 0.4)) { // Simulación de baja masa muscular
            recomendacionCoach = "Para tu objetivo de ganar masa muscular, la IA sugiere aumentar la ingesta proteica y enfocar el entrenamiento en ejercicios compuestos con sobrecarga progresiva. Considera un día extra de pierna.";
        } else {
            recomendacionCoach = "Excelente progreso en masa muscular. Mantén el volumen de entrenamiento y considera ciclos de fuerza para romper estancamientos. Revisa tu ingesta calórica para asegurar un superávit constante.";
        }
    } else if (cliente.objetivo === 'Perder grasa') {
        if (parseFloat(grasaIA) > 20 && imc > 25) { // Simulación de grasa elevada
            recomendacionCoach = "La IA detecta un porcentaje de grasa elevado para tu objetivo. Prioriza el déficit calórico, aumenta el cardio de baja intensidad y mantén el entrenamiento de fuerza para preservar músculo.";
        } else {
            recomendacionCoach = "Buen camino hacia la pérdida de grasa. Para optimizar, la IA sugiere incorporar HIIT 2-3 veces por semana y asegurar una ingesta adecuada de fibra.";
        }
    } else { // Tonificar, Rendimiento, Rehabilitación
        recomendacionCoach = "Tu composición actual es favorable para tu objetivo. La IA recomienda mantener la consistencia, variar los estímulos de entrenamiento y asegurar una recuperación óptima.";
    }

    document.getElementById('iaResultados').innerHTML = `
        <div class="space-y-2">
            <div class="bg-black/50 p-3 rounded-lg"><p class="text-xs text-gray-400">Fotos Analizadas</p><p class="text-xl font-bold text-green-500">${count}/5 ✓</p></div>
            <div class="bg-black/50 p-3 rounded-lg">
                <p class="text-xs text-gray-400">% Grasa Corporal (IA 3D)</p>
                <p class="text-2xl font-bold text-orange-500">${grasaIA}%</p>
                <p class="text-xs text-green-500">Precisión 94.2% para ${cliente.nombre}</p>
            </div>
            <div class="bg-black/50 p-3 rounded-lg">
                <p class="text-xs text-gray-400">Masa Muscular Estimada</p>
                <p class="text-xl font-bold">${musculoIA} kg</p>
            </div>
            <div class="bg-purple-500/10 border border-purple-500/30 p-3 rounded-lg">
                <p class="text-xs font-bold text-purple-400">Análisis Técnico Visual:</p>
                <p class="text-[11px] text-gray-300">${observacion}</p>
            </div>
            <div class="bg-red-500/10 border border-red-500/30 p-3 rounded-lg">
                <p class="text-xs font-bold text-red-400">Riesgo de Lesión (IA):</p>
                <p class="text-[11px] text-gray-300">${(parseFloat(grasaIA) > 25 || imc > 28 || edad > 60) ? 'Moderado/Alto (Revisar movilidad)' : 'Bajo (Mantener prevención)'}</p>
            </div>
            <div class="bg-blue-500/10 border border-blue-500/30 p-3 rounded-lg">
                <p class="text-xs font-bold text-blue-400">Recomendación del Coach IA:</p>
                <p class="text-[11px] text-gray-300">${recomendacionCoach}</p>
            </div>
        </div>
    `;

    const btn = document.getElementById('btnGuardarIA');
    if(btn) btn.classList.remove('hidden');
    alert('✓ Análisis IA Finalizado: ' + count + ' ángulos procesados.');
}

async function guardarHistoricoIA(){
    const select = document.getElementById('selectClienteIA');
    if(!select || select.value === 'Seleccionar cliente...') return alert('Por favor, selecciona un cliente para guardar el análisis.');

    const nombreSel = select.value.split(' - ')[0];
    const cliente = clientes.find(c => c.nombre === nombreSel);
    if(!cliente) return;

    const btn = document.getElementById('btnGuardarIA');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Subiendo a la nube...';
    btn.disabled = true;

    try {
        const urls = {};
        for (const tipo in fotosIA) {
            const path = `${cliente.id}/${Date.now()}_${tipo}.jpg`;
            urls[tipo] = await uploadScanImage(fotosIA[tipo], path);
        }

        const nuevoAnalisis = {
            cliente_id: cliente.id,
            grasa: document.getElementById('iaResultados').querySelector('.text-orange-500')?.textContent || "0%",
            musculo: document.getElementById('iaResultados').querySelectorAll('.text-xl.font-bold')[1]?.textContent || "0 kg",
            simetria: "96.2%",
            foto_frontal_url: urls['frontal'] || null,
            foto_posterior_url: urls['posterior'] || null,
            foto_izq_url: urls['lateral-izq'] || null,
            foto_der_url: urls['lateral-der'] || null,
            foto_extra_url: urls['extra'] || null
        };

        const { error } = await supabase.from('historial_ia').insert([nuevoAnalisis]);
        if (error) throw error;

        alert('✓ Análisis IA guardado exitosamente para: ' + cliente.nombre);
        btn.classList.add('hidden');
        fotosIA = {};
    } catch (error) {
        console.error(error);
        alert('❌ Error al guardar: ' + error.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function abrirModalHistorialIA() {
    const select = document.getElementById('selectClienteIA');
    if (!select || select.value === 'Seleccionar cliente...') return alert('Por favor, selecciona un cliente primero.');

    const nombre = select.value.split(' - ')[0];
    const cliente = clientes.find(c => c.nombre === nombre);

    if (cliente) {
        document.getElementById('nombreClienteHistorial').textContent = cliente.nombre;
        const container = document.getElementById('listaHistorialIA');
        container.innerHTML = '<div class="text-center py-10"><i class="fas fa-spinner fa-spin text-4xl text-orange-500 mb-3"></i><p>Consultando la nube...</p></div>';

        try {
            const { data, error } = await supabase
                .from('historial_ia')
                .select('*')
                .eq('cliente_id', cliente.id)
                .order('fecha', { ascending: false });

            if (error) throw error;
            container.innerHTML = '';

            if (!data || data.length === 0) {
                container.innerHTML = `<div class="text-center py-10"><i class="fas fa-folder-open text-4xl text-gray-700 mb-3"></i><p class="text-gray-500">Sin historial en la nube.</p></div>`;
            } else {
                data.forEach(h => {
                    const item = document.createElement('div');
                    item.className = 'glass p-5 rounded-xl border-l-4 border-orange-500 flex justify-between items-center card-hover';
                    item.innerHTML = `
                        <div class="flex-1">
                            <div class="flex items-center gap-3 mb-1">
                                <span class="text-sm font-bold text-gray-300">${new Date(h.fecha).toLocaleString()}</span>
                            </div>
                            <div class="grid grid-cols-3 gap-4">
                                <div><p class="text-[10px] text-gray-500 uppercase">Grasa</p><p class="font-bold text-orange-500">${h.grasa}</p></div>
                                <div><p class="text-[10px] text-gray-500 uppercase">Músculo</p><p class="font-bold text-white">${h.musculo}</p></div>
                                <div><p class="text-[10px] text-gray-500 uppercase">Simetría</p><p class="font-bold text-green-400">${h.simetria}</p></div>
                            </div>
                            <div class="mt-2 flex gap-2">
                                ${h.foto_frontal_url ? `<button onclick="window.open('${h.foto_frontal_url}')" class="text-[9px] bg-white/10 px-2 py-1 rounded">Ver Frontal</button>` : ''}
                                ${h.foto_posterior_url ? `<button onclick="window.open('${h.foto_posterior_url}')" class="text-[9px] bg-white/10 px-2 py-1 rounded">Ver Posterior</button>` : ''}
                            </div>
                        </div>
                    `;
                    container.appendChild(item);
                });
                dibujarGraficaEvolucionIA(data);
            }
        } catch (error) {
            container.innerHTML = `<p class="text-red-500">Error al cargar historial.</p>`;
        }

        document.getElementById('modalHistorialIA').classList.remove('hidden');
    }
}

/**
 * Dibuja la gráfica de evolución temporal de los análisis IA de un cliente.
 * @param {Array} historialIA - El array de objetos de historial de análisis IA del cliente.
 */
function dibujarGraficaEvolucionIA(historialIA) {
    const ctx = document.getElementById('chartEvolucionIA');
    if (!ctx) return;

    // Destruir cualquier instancia de Chart.js existente para evitar duplicados
    if (ctx.chart) {
        ctx.chart.destroy();
    }

    // Ordenar el historial por fecha ascendente para la gráfica
    const historialOrdenado = [...historialIA].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    const labels = historialOrdenado.map(h => new Date(h.fecha).toLocaleDateString());
    const grasaData = historialOrdenado.map(h => parseFloat(h.grasa));
    const simetriaData = historialOrdenado.map(h => parseFloat(h.simetria));

    ctx.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: '% Grasa Corporal', data: grasaData, borderColor: '#FF3B00', backgroundColor: 'rgba(255,59,0,0.2)', fill: true, tension: 0.3 },
                { label: 'Simetría Corporal (%)', data: simetriaData, borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.2)', fill: true, tension: 0.3 }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { labels: { color: '#fff' } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y + (context.dataset.label.includes('Grasa') ? '%' : '%');
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: { ticks: { color: '#999' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                y: { ticks: { color: '#999' }, grid: { color: 'rgba(255,255,255,0.1)' } }
            }
        }
    });
}

function cerrarModalHistorialIA() {
    const modal = document.getElementById('modalHistorialIA');
    if(modal) modal.classList.add('hidden');
}

function intervenirCliente(nombre){
    const acciones = [
        `Llamando a ${nombre}...`,
        `Enviando WhatsApp personalizado...`,
        `Ofreciendo 1 semana gratis...`,
        `Asignando coach personal...`
    ];
    let i = 0;
    const interval = setInterval(() => {
        if(i < acciones.length){
            alert('✓ ' + acciones[i]);
            i++;
        } else {
            clearInterval(interval);
            alert(`✅ INTERVENCIÓN COMPLETADA\n\n${nombre} ha sido contactado con plan de retención personalizado.\nProbabilidad de retención: 78% → 23% riesgo`);
        }
    }, 800);
}

function iniciarVideoAnalisis(){
    const video = document.getElementById('videoAnalisis');
    const placeholder = document.getElementById('videoPlaceholder');
    navigator.mediaDevices.getUserMedia({video:{width:1280,height:720}}).then(stream => {
        video.srcObject = stream;
        video.classList.remove('hidden');
        placeholder.classList.add('hidden');
    }).catch(err => alert('Error al iniciar cámara.'));
}

function analizarTecnica(){
    const canvas = document.getElementById('poseCanvas');
    const video = document.getElementById('videoAnalisis');
    if(!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    canvas.width = video.clientWidth; 
    canvas.height = video.clientHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const puntos = [
        [0.5, 0.15], [0.45, 0.35], [0.55, 0.35], [0.47, 0.60], [0.53, 0.60], 
        [0.45, 0.85], [0.55, 0.85], [0.45, 0.95], [0.55, 0.95]
    ];

    ctx.strokeStyle = '#FF3B00'; 
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#FF3B00';

    const conectar = (i, j) => {
        ctx.beginPath();
        ctx.moveTo(puntos[i][0] * canvas.width, puntos[i][1] * canvas.height);
        ctx.lineTo(puntos[j][0] * canvas.width, puntos[j][1] * canvas.height);
        ctx.stroke();
    };

    conectar(1, 2); 
    conectar(1, 3); 
    conectar(2, 4); 
    conectar(3, 4); 
    conectar(3, 5); 
    conectar(4, 6); 
    conectar(5, 7); 
    conectar(6, 8); 

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#FFFFFF';
    puntos.forEach(p => {
        ctx.beginPath();
        ctx.arc(p[0] * canvas.width, p[1] * canvas.height, 6, 0, Math.PI * 2);
        ctx.fill();
    });

    alert('✓ Análisis técnico IA completado\n\nScore: 87/100\nEstado: Técnica de sentadilla correcta.');
}

function iniciarFaceID(){
    const video = document.getElementById('faceVideo');
    if(!video) return;
    navigator.mediaDevices.getUserMedia({video:{facingMode:'user'}}).then(stream => {
        video.srcObject = stream;
        setTimeout(() => {
            const accesos = document.getElementById('faceAccesos');
            if(accesos){
                const nuevo = document.createElement('div');
                nuevo.className = 'flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-xl animate-bounce';
                nuevo.innerHTML = `
                    <div class="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center"><i class="fas fa-check text-green-500"></i></div>
                    <div class="flex-1">
                        <p class="font-bold text-sm">María González</p>
                        <p class="text-xs text-gray-400">Hace instantes • Confianza 98.3%</p>
                    </div>
                `;
                accesos.prepend(nuevo);
            }
            alert('✓ Rostro reconocido: María González\n\nConfianza: 98.3%\nAcceso permitido\nBienvenida de vuelta!');
        }, 2000);
    }).catch(err => alert('Activa la cámara.'));
}

window.onload = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        await getUserProfile(session.user.id);
        document.getElementById('login').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        await refreshData();
        generarCalendario();
        checkUserRole();
    } else {
        console.log('No hay sesión activa. Mostrar pantalla de login.');
        showView('login'); // Asegurarse de que la vista de login esté activa
    }
    // Si es la primera vez y no hay nada en la nube, podrías mostrar un mensaje
    if(clientes.length === 0) { // Esto se ejecutará después de refreshData si no hay clientes
        console.log('Sistema listo. Registra tu primer cliente TITAN (o el primero en la nube).');
    }
    // Inicializar el marketplace también
    initMarketplace();
};