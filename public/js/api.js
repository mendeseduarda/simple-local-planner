const API = 'http://localhost:3000/api';

async function fetchTasks() {
    const response = await fetch(`${API}/tasks`);
    return await response.json();
}

async function fetchCategories() {
    const response = await fetch(`${API}/categories`);
    return await response.json();
}

async function saveTask(taskData, id = null) {
    const url = id ? `${API}/tasks/${id}` : `${API}/tasks`;
    const method = id ? 'PATCH' : 'POST';
    
    const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
    });
    
    if (!response.ok) throw new Error('Erro ao salvar tarefa');
    return await response.json();
}

async function deleteTaskById(id) {
    const response = await fetch(`${API}/tasks/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Erro ao excluir tarefa');
}

async function toggleTaskComplete(id, status) {
    const response = await fetch(`${API}/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: status })
    });
    if (!response.ok) throw new Error('Erro ao atualizar tarefa');
}

async function sendEmail(tasksArr, email, subject = null) {
    const response = await fetch(`${API}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: tasksArr, email, subject })
    });
    return response.ok;
}

async function saveCategory(catData) {
    const response = await fetch(`${API}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(catData)
    });
    if (!response.ok) throw new Error('Erro ao salvar categoria');
    return await response.json();
}

async function deleteCategoryById(id) {
    const response = await fetch(`${API}/categories/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Erro ao excluir categoria');
}

window.PlannerAPI = {
    fetchTasks,
    fetchCategories,
    saveTask,
    saveCategory,
    deleteTaskById,
    deleteCategoryById,
    toggleTaskComplete,
    sendEmail
};
