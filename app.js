(function () {
  'use strict';

  var STORAGE_KEY = 'todo-app.v1';

  var FILTERS = {
    all: function () { return true; },
    active: function (todo) { return !todo.completed; },
    completed: function (todo) { return todo.completed; }
  };

  var EMPTY_MESSAGES = {
    all: 'TODOはまだありません。上の入力欄から追加しましょう。',
    active: '未完了のTODOはありません 🎉',
    completed: '完了済みのTODOはありません。'
  };

  var state = {
    todos: load(),
    filter: 'all',
    editingId: null
  };

  var els = {
    form: document.getElementById('new-todo-form'),
    input: document.getElementById('new-todo'),
    toggleAll: document.getElementById('toggle-all'),
    list: document.getElementById('todo-list'),
    empty: document.getElementById('empty'),
    footer: document.getElementById('footer'),
    count: document.getElementById('count'),
    filterLinks: document.querySelectorAll('.filters a'),
    clearCompleted: document.getElementById('clear-completed')
  };

  // ---- 永続化 ----

  function load() {
    try {
      var data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!Array.isArray(data)) return [];
      return data.filter(function (t) {
        return t && typeof t.id === 'string' && typeof t.title === 'string';
      }).map(function (t) {
        return { id: t.id, title: t.title, completed: !!t.completed, createdAt: t.createdAt || Date.now() };
      });
    } catch (e) {
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.todos));
    } catch (e) {
      // プライベートモード等で保存できない場合はメモリ上のみで動作する
    }
  }

  // ---- 状態の更新 ----

  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function findTodo(id) {
    for (var i = 0; i < state.todos.length; i++) {
      if (state.todos[i].id === id) return state.todos[i];
    }
    return null;
  }

  function commit() {
    save();
    render();
  }

  function addTodo(title) {
    state.todos.push({ id: newId(), title: title, completed: false, createdAt: Date.now() });
    commit();
  }

  function toggleTodo(id) {
    var todo = findTodo(id);
    if (!todo) return;
    todo.completed = !todo.completed;
    commit();
  }

  function deleteTodo(id) {
    state.todos = state.todos.filter(function (t) { return t.id !== id; });
    commit();
  }

  function updateTitle(id, title) {
    var todo = findTodo(id);
    if (!todo) return;
    if (title === '') {
      deleteTodo(id);
      return;
    }
    todo.title = title;
    commit();
  }

  function setAllCompleted(completed) {
    state.todos.forEach(function (t) { t.completed = completed; });
    commit();
  }

  function clearCompleted() {
    state.todos = state.todos.filter(FILTERS.active);
    commit();
  }

  // ---- 描画 ----

  function renderTodo(todo) {
    var li = document.createElement('li');
    li.className = 'todo' + (todo.completed ? ' completed' : '');
    li.dataset.id = todo.id;

    var checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'toggle';
    checkbox.checked = todo.completed;
    checkbox.setAttribute('aria-label', '「' + todo.title + '」の完了状態');
    li.appendChild(checkbox);

    if (state.editingId === todo.id) {
      var edit = document.createElement('input');
      edit.type = 'text';
      edit.className = 'edit';
      edit.value = todo.title;
      edit.maxLength = 200;
      edit.setAttribute('aria-label', 'TODOを編集');
      li.appendChild(edit);
    } else {
      var title = document.createElement('span');
      title.className = 'title';
      title.textContent = todo.title;
      title.title = 'ダブルクリックで編集';
      li.appendChild(title);
    }

    var del = document.createElement('button');
    del.type = 'button';
    del.className = 'delete';
    del.textContent = '×';
    del.setAttribute('aria-label', '「' + todo.title + '」を削除');
    li.appendChild(del);

    return li;
  }

  function render() {
    var visible = state.todos.filter(FILTERS[state.filter]);
    var activeCount = state.todos.filter(FILTERS.active).length;
    var completedCount = state.todos.length - activeCount;

    var fragment = document.createDocumentFragment();
    visible.forEach(function (todo) { fragment.appendChild(renderTodo(todo)); });
    els.list.replaceChildren(fragment);

    els.empty.hidden = visible.length > 0;
    els.empty.textContent = EMPTY_MESSAGES[state.filter];

    els.footer.hidden = state.todos.length === 0;
    els.count.textContent = '残り ' + activeCount + ' 件';
    els.clearCompleted.disabled = completedCount === 0;
    els.clearCompleted.textContent = '完了済みを削除 (' + completedCount + ')';

    els.toggleAll.hidden = state.todos.length === 0;
    els.toggleAll.classList.toggle('active', state.todos.length > 0 && activeCount === 0);

    els.filterLinks.forEach(function (a) {
      var selected = a.dataset.filter === state.filter;
      a.classList.toggle('selected', selected);
      if (selected) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });

    var editInput = els.list.querySelector('.edit');
    if (editInput) {
      editInput.focus();
      editInput.setSelectionRange(editInput.value.length, editInput.value.length);
    }
  }

  // ---- 編集 ----

  function startEditing(id) {
    state.editingId = id;
    render();
  }

  function finishEditing(input, keep) {
    // Enter 確定後の blur などで二重に処理しないようにする
    var id = state.editingId;
    if (id === null) return;
    state.editingId = null;
    if (keep) {
      updateTitle(id, input.value.trim());
    } else {
      render();
    }
  }

  // ---- イベント ----

  function idOf(el) {
    var li = el.closest('.todo');
    return li ? li.dataset.id : null;
  }

  els.form.addEventListener('submit', function (e) {
    e.preventDefault();
    var title = els.input.value.trim();
    if (!title) return;
    addTodo(title);
    els.input.value = '';
    els.input.focus();
  });

  els.toggleAll.addEventListener('click', function () {
    var allDone = state.todos.every(FILTERS.completed);
    setAllCompleted(!allDone);
  });

  els.list.addEventListener('change', function (e) {
    if (e.target.classList.contains('toggle')) toggleTodo(idOf(e.target));
  });

  els.list.addEventListener('click', function (e) {
    if (e.target.classList.contains('delete')) deleteTodo(idOf(e.target));
  });

  els.list.addEventListener('dblclick', function (e) {
    if (e.target.classList.contains('title')) startEditing(idOf(e.target));
  });

  els.list.addEventListener('keydown', function (e) {
    if (!e.target.classList.contains('edit') || e.isComposing) return;
    if (e.key === 'Enter') finishEditing(e.target, true);
    else if (e.key === 'Escape') finishEditing(e.target, false);
  });

  els.list.addEventListener('focusout', function (e) {
    if (e.target.classList.contains('edit')) finishEditing(e.target, true);
  });

  els.clearCompleted.addEventListener('click', clearCompleted);

  function applyRoute() {
    var route = location.hash.replace(/^#\/?/, '');
    state.filter = FILTERS.hasOwnProperty(route) && route !== 'all' ? route : 'all';
    render();
  }

  window.addEventListener('hashchange', applyRoute);

  // 別タブでの変更を反映する
  window.addEventListener('storage', function (e) {
    if (e.key !== STORAGE_KEY) return;
    state.todos = load();
    state.editingId = null;
    render();
  });

  applyRoute();
})();
