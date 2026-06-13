/* ============================================================
   SuperNovel - Web Frontend Application
   ============================================================ */

(function () {
  'use strict';

  // ---- Application State ----
  const state = {
    config: null,
    currentView: 'create',
    ws: null,
    generating: false,
    chaptersList: [],
    currentChapter: null,
    currentRoleCategory: '全部',
    wsReconnectTimer: null,
  };

  // ---- API Base URL ----
  const API_BASE = '';

  // ---- Utility: API Helpers ----
  async function apiGet(path) {
    const resp = await fetch(API_BASE + path);
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(err || 'GET ' + path + ' failed (' + resp.status + ')');
    }
    var data = resp.json();
    return data.then(function(d) {
      // Unwrap config endpoint response
      if (d.config !== undefined && d.status === 'ok' && path.indexOf('/api/config') === 0 && path.indexOf('test') === -1) {
        return d.config;
      }
      return d;
    });
  }

  async function apiPost(path, body) {
    const resp = await fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(err || `POST ${path} failed (${resp.status})`);
    }
    return resp.json();
  }

  async function apiDelete(path) {
    const resp = await fetch(API_BASE + path, { method: 'DELETE' });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(err || `DELETE ${path} failed (${resp.status})`);
    }
    return resp.json();
  }

  // ---- Utility: DOM Helpers ----
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }

  function val(id) {
    const el = document.getElementById(id);
    if (!el) return '';
    if (el.type === 'checkbox') return el.checked;
    return el.value.trim();
  }

  function setVal(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === 'checkbox') { el.checked = !!value; return; }
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      el.value = value != null ? value : '';
    } else if (el.tagName === 'SELECT') {
      el.value = value != null ? value : '';
    }
  }

  function getFilePath() { return val('filepath'); }

  function getLLMConfigName(stepId) {
    var sel = document.getElementById(stepId);
    if (sel && sel.value) return sel.value;
    return val('llmConfigSelect');
  }

  function getEmbeddingConfigName() {
    return val('embeddingConfigSelect');
  }

  // ---- Toast Notifications ----
  function showToast(msg, type) {
    type = type || 'info';
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function () {
      toast.style.animation = 'slideOut 0.3s ease forwards';
      setTimeout(function () { toast.remove(); }, 300);
    }, 3000);
  }

  // ---- Log Panel ----
  function appendLog(msg) {
    const el = document.getElementById('log-content');
    if (!el) return;
    const div = document.createElement('div');
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    div.textContent = '[' + time + '] ' + msg;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
  }

  function clearLog() {
    const el = document.getElementById('log-content');
    if (el) el.innerHTML = '';
  }

  // ---- Generating State ----
  function setGenerating(busy) {
    state.generating = busy;
    var buttons = $$('.btn-primary, .btn-success');
    buttons.forEach(function (btn) {
      if (busy) {
        btn._wasDisabled = btn.disabled;
        btn.disabled = true;
      } else {
        btn.disabled = btn._wasDisabled || false;
      }
    });
  }

  // ---- View Switching ----
  var viewTitles = {
    create: '创作工作台',
    config: '配置管理',
    architecture: '小说架构',
    blueprint: '章节蓝图',
    characters: '角色管理',
    summary: '全局摘要',
    chapters: '章节管理',
    settings: '其他设置',
  };

  function switchView(name) {
    state.currentView = name;

    $$('.view').forEach(function (v) { v.classList.remove('active'); });
    $$('.nav-item').forEach(function (n) { n.classList.remove('active'); });

    var view = document.getElementById('view-' + name);
    if (view) view.classList.add('active');

    var nav = document.querySelector('.nav-item[data-view="' + name + '"]');
    if (nav) nav.classList.add('active');

    var title = document.getElementById('view-title');
    if (title) title.textContent = viewTitles[name] || name;

    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('open');
  }

  // ---- WebSocket ----
  function connectWebSocket() {
    var protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    var wsUrl = protocol + '//' + location.host + '/ws';

    try {
      state.ws = new WebSocket(wsUrl);
    } catch (e) {
      appendLog('WebSocket 连接失败: ' + e.message);
      return;
    }

    state.ws.onopen = function () {
      appendLog('WebSocket 已连接');
    };

    state.ws.onmessage = function (event) {
      try {
        var data = JSON.parse(event.data);
        if (data.type === 'log' && data.message) {
          appendLog(data.message);
        } else if (data.type === 'status') {
          if (data.generating !== undefined) {
            setGenerating(data.generating);
          }
        } else if (data.type === 'toast') {
          showToast(data.message, data.level || 'info');
        } else {
          appendLog(event.data);
        }
      } catch (e) {
        appendLog(event.data);
      }
    };

    state.ws.onclose = function () {
      appendLog('WebSocket 连接已断开，5秒后重连...');
      clearTimeout(state.wsReconnectTimer);
      state.wsReconnectTimer = setTimeout(connectWebSocket, 5000);
    };

    state.ws.onerror = function () {
      appendLog('WebSocket 连接出错');
    };
  }

  // ---- Word Count ----
  function countWords(text) {
    if (!text) return 0;
    // Count Chinese characters + English words
    var chinese = (text.match(/[一-鿿]/g) || []).length;
    var english = (text.match(/[a-zA-Z]+/g) || []).length;
    return chinese + english;
  }

  function setupWordCount(textareaId, countId) {
    var ta = document.getElementById(textareaId);
    var counter = document.getElementById(countId);
    if (!ta || !counter) return;

    function update() {
      counter.textContent = '字数：' + countWords(ta.value);
    }

    ta.addEventListener('input', update);
    ta.addEventListener('mouseup', update);
  }

  // ---- Config: Populate Forms ----
  function populateForm(config) {
    if (!config) return;
    state.config = config;

    // Novel params
    var op = config.other_params || {};
    setVal('topic', op.topic || '');
    setVal('genre', op.genre || '玄幻');
    setVal('num_chapters', op.num_chapters || 10);
    setVal('word_number', op.word_number || 3000);
    setVal('filepath', op.filepath || '');
    setVal('chapter_num', op.chapter_num || 1);
    setVal('user_guidance', op.user_guidance || '');
    setVal('characters_involved', op.characters_involved || '');
    setVal('key_items', op.key_items || '');
    setVal('scene_location', op.scene_location || '');
    setVal('time_constraint', op.time_constraint || '');

    // LLM configs
    var llmConfigs = config.llm_configs || {};
    var configNames = Object.keys(llmConfigs);
    populateSelect('llmConfigSelect', configNames);
    if (configNames.length > 0) {
      var first = configNames[0];
      document.getElementById('llmConfigSelect').value = first;
      loadLLMConfigFields(first);
    }

    // Step configs
    var cc = config.choose_configs || {};
    populateStepConfigSelects(configNames, cc);

    // Embedding
    var embConfigs = config.embedding_configs || {};
    var embConfigNames = Object.keys(embConfigs);
    populateSelect('embeddingConfigSelect', embConfigNames);
    if (embConfigNames.length > 0) {
      var firstEmb = embConfigNames[0];
      document.getElementById('embeddingConfigSelect').value = firstEmb;
      loadEmbeddingConfigFields(firstEmb, config);
    }

    // Proxy
    var proxy = config.proxy_setting || {};
    document.getElementById('proxy_enabled').checked = !!proxy.enabled;
    setVal('proxy_url', proxy.proxy_url || '127.0.0.1');
    setVal('proxy_port', proxy.proxy_port || '10809');

    // WebDAV
    var webdav = config.webdav_config || {};
    setVal('webdav_url', webdav.webdav_url || '');
    setVal('webdav_username', webdav.webdav_username || '');
    setVal('webdav_password', webdav.webdav_password || '');
  }

  function populateSelect(selectId, options) {
    var sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = '';
    options.forEach(function (opt) {
      var o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      sel.appendChild(o);
    });
  }

  function populateStepConfigSelects(configNames, chooseConfigs) {
    var stepIds = ['architecture_llm', 'chapter_outline_llm', 'prompt_draft_llm', 'final_chapter_llm', 'consistency_review_llm'];
    stepIds.forEach(function (id) {
      populateSelect(id, configNames);
      if (chooseConfigs[id]) {
        setVal(id, chooseConfigs[id]);
      } else if (configNames.length > 0) {
        setVal(id, configNames[0]);
      }
    });
  }

  function loadLLMConfigFields(configName) {
    if (!state.config || !state.config.llm_configs) return;
    var conf = state.config.llm_configs[configName];
    if (!conf) return;
    setVal('api_key', conf.api_key || '');
    setVal('base_url', conf.base_url || '');
    setVal('model_name', conf.model_name || '');
    setVal('interface_format', conf.interface_format || 'OpenAI');
    setVal('temperature', conf.temperature != null ? conf.temperature : 0.7);
    document.getElementById('temperatureValue').textContent = parseFloat(conf.temperature != null ? conf.temperature : 0.7).toFixed(2);
    setVal('max_tokens', conf.max_tokens || 8192);
    setVal('timeout', conf.timeout || 600);
  }

  // ---- Config: LLM CRUD ----
  async function saveLLMConfig() {
    var configName = val('llmConfigSelect');
    if (!configName) { showToast('请先选择配置', 'warning'); return; }

    try {
      var current = await apiGet('/api/config');
      if (!current.llm_configs) current.llm_configs = {};

      current.llm_configs[configName] = {
        api_key: val('api_key'),
        base_url: val('base_url'),
        model_name: val('model_name'),
        interface_format: val('interface_format'),
        temperature: parseFloat(val('temperature')) || 0.7,
        max_tokens: parseInt(val('max_tokens')) || 8192,
        timeout: parseInt(val('timeout')) || 600,
      };

      // Also save other fields
      current.other_params = gatherOtherParams();
      current.embedding_configs = current.embedding_configs || {};
      current.embedding_configs[val('embeddingConfigSelect')] = gatherEmbeddingParams();

      await apiPost('/api/config', current);
      state.config = current;
      showToast('LLM 配置已保存', 'success');
      appendLog('配置 ' + configName + ' 已保存');
    } catch (e) {
      showToast('保存失败: ' + e.message, 'error');
    }
  }

  async function addLLMConfig() {
    var name = prompt('请输入新配置名称:');
    if (!name || !name.trim()) return;
    name = name.trim();

    try {
      var current = await apiGet('/api/config');
      if (current.llm_configs && current.llm_configs[name]) {
        showToast('配置名称已存在', 'error');
        return;
      }
      if (!current.llm_configs) current.llm_configs = {};
      current.llm_configs[name] = {
        api_key: '',
        base_url: '',
        model_name: '',
        interface_format: 'OpenAI',
        temperature: 0.7,
        max_tokens: 8192,
        timeout: 600,
      };
      await apiPost('/api/config', current);
      state.config = current;
      populateSelect('llmConfigSelect', Object.keys(current.llm_configs));
      document.getElementById('llmConfigSelect').value = name;
      loadLLMConfigFields(name);
      populateStepConfigSelects(Object.keys(current.llm_configs), current.choose_configs || {});
      showToast('已创建配置: ' + name, 'success');
    } catch (e) {
      showToast('创建失败: ' + e.message, 'error');
    }
  }

  async function deleteLLMConfig() {
    var name = val('llmConfigSelect');
    if (!name) return;
    if (!confirm('确定要删除配置 "' + name + '" 吗?')) return;

    try {
      var current = await apiGet('/api/config');
      if (Object.keys(current.llm_configs || {}).length <= 1) {
        showToast('至少需要保留一个配置', 'error');
        return;
      }
      delete current.llm_configs[name];
      await apiPost('/api/config', current);
      state.config = current;
      var names = Object.keys(current.llm_configs);
      populateSelect('llmConfigSelect', names);
      if (names.length > 0) {
        document.getElementById('llmConfigSelect').value = names[0];
        loadLLMConfigFields(names[0]);
      }
      populateStepConfigSelects(names, current.choose_configs || {});
      showToast('已删除配置: ' + name, 'success');
    } catch (e) {
      showToast('删除失败: ' + e.message, 'error');
    }
  }

  async function renameLLMConfig() {
    var oldName = val('llmConfigSelect');
    if (!oldName) return;
    var newName = prompt('请输入新名称 (原名称: ' + oldName + '):');
    if (!newName || !newName.trim() || newName.trim() === oldName) return;
    newName = newName.trim();

    try {
      var current = await apiGet('/api/config');
      if (current.llm_configs[newName]) {
        showToast('名称已存在', 'error');
        return;
      }
      current.llm_configs[newName] = current.llm_configs[oldName];
      delete current.llm_configs[oldName];
      await apiPost('/api/config', current);
      state.config = current;
      var names = Object.keys(current.llm_configs);
      populateSelect('llmConfigSelect', names);
      document.getElementById('llmConfigSelect').value = newName;
      populateStepConfigSelects(names, current.choose_configs || {});
      showToast('已重命名为: ' + newName, 'success');
    } catch (e) {
      showToast('重命名失败: ' + e.message, 'error');
    }
  }

  // ---- Config: Embedding CRUD ----
  function loadEmbeddingConfigFields(name, cfg) {
    var current = cfg || state.config;
    if (!current || !current.embedding_configs) return;
    var conf = current.embedding_configs[name] || {};
    setVal('embedding_interface_format', conf.interface_format || 'OpenAI');
    setVal('embedding_api_key', conf.api_key || '');
    setVal('embedding_base_url', conf.base_url || '');
    setVal('embedding_model_name', conf.model_name || '');
    setVal('embedding_retrieval_k', conf.retrieval_k || 4);
  }

  async function addEmbeddingConfig() {
    var name = prompt('请输入新 Embedding 配置名称:');
    if (!name || !name.trim()) return;
    name = name.trim();
    try {
      var current = await apiGet('/api/config');
      if (!current.embedding_configs) current.embedding_configs = {};
      if (current.embedding_configs[name]) {
        showToast('配置已存在: ' + name, 'warning'); return;
      }
      current.embedding_configs[name] = {
        api_key: '',
        base_url: '',
        model_name: '',
        interface_format: 'OpenAI',
        retrieval_k: 4,
      };
      await apiPost('/api/config', current);
      state.config = current;
      populateSelect('embeddingConfigSelect', Object.keys(current.embedding_configs));
      document.getElementById('embeddingConfigSelect').value = name;
      loadEmbeddingConfigFields(name);
      showToast('已创建 Embedding 配置: ' + name, 'success');
    } catch (e) {
      showToast('创建失败: ' + e.message, 'error');
    }
  }

  async function deleteEmbeddingConfig() {
    var name = val('embeddingConfigSelect');
    if (!name) return;
    if (!confirm('确定要删除 Embedding 配置 "' + name + '" 吗?')) return;
    try {
      var current = await apiGet('/api/config');
      if (!current.embedding_configs || !current.embedding_configs[name]) {
        showToast('配置不存在', 'warning'); return;
      }
      delete current.embedding_configs[name];
      await apiPost('/api/config', current);
      state.config = current;
      var names = Object.keys(current.embedding_configs);
      populateSelect('embeddingConfigSelect', names);
      if (names.length > 0) {
        document.getElementById('embeddingConfigSelect').value = names[0];
        loadEmbeddingConfigFields(names[0]);
      }
      showToast('已删除 Embedding 配置: ' + name, 'success');
    } catch (e) {
      showToast('删除失败: ' + e.message, 'error');
    }
  }

  async function renameEmbeddingConfig() {
    var oldName = val('embeddingConfigSelect');
    if (!oldName) return;
    var newName = prompt('请输入新名称 (原名称: ' + oldName + '):');
    if (!newName || !newName.trim() || newName.trim() === oldName) return;
    newName = newName.trim();
    try {
      var current = await apiGet('/api/config');
      if (!current.embedding_configs || !current.embedding_configs[oldName]) {
        showToast('配置不存在', 'warning'); return;
      }
      current.embedding_configs[newName] = current.embedding_configs[oldName];
      delete current.embedding_configs[oldName];
      await apiPost('/api/config', current);
      state.config = current;
      var names = Object.keys(current.embedding_configs);
      populateSelect('embeddingConfigSelect', names);
      document.getElementById('embeddingConfigSelect').value = newName;
      loadEmbeddingConfigFields(newName);
      showToast('已重命名为: ' + newName, 'success');
    } catch (e) {
      showToast('重命名失败: ' + e.message, 'error');
    }
  }

  async function testLLM() {
    try {
      appendLog('正在测试 LLM 配置...');
      var result = await apiPost('/api/config/test-llm', {
        interface_format: val('interface_format'),
        api_key: val('api_key'),
        base_url: val('base_url'),
        model_name: val('model_name'),
        temperature: parseFloat(val('temperature')) || 0.7,
        max_tokens: parseInt(val('max_tokens')) || 8192,
        timeout: parseInt(val('timeout')) || 600,
      });
      if (result.status === 'ok') {
        showToast('LLM 连接测试成功', 'success');
        appendLog('LLM 测试通过');
      } else {
        showToast('测试失败: ' + (result.message || '未知错误'), 'error');
        appendLog('LLM 测试失败: ' + (result.message || ''));
      }
    } catch (e) {
      showToast('测试失败: ' + e.message, 'error');
      appendLog('LLM 测试出错: ' + e.message);
    }
  }

  async function testEmbedding() {
    try {
      appendLog('正在测试 Embedding 配置...');
      var result = await apiPost('/api/config/test-embedding', {
        interface_format: val('embedding_interface_format'),
        api_key: val('embedding_api_key'),
        base_url: val('embedding_base_url'),
        model_name: val('embedding_model_name'),
      });
      if (result.status === 'ok') {
        showToast('Embedding 连接测试成功', 'success');
        appendLog('Embedding 测试通过');
      } else {
        showToast('测试失败: ' + (result.message || '未知错误'), 'error');
      }
    } catch (e) {
      showToast('测试失败: ' + e.message, 'error');
    }
  }

  async function saveStepConfig() {
    try {
      var current = await apiGet('/api/config');
      current.choose_configs = {
        architecture_llm: val('architecture_llm'),
        chapter_outline_llm: val('chapter_outline_llm'),
        prompt_draft_llm: val('prompt_draft_llm'),
        final_chapter_llm: val('final_chapter_llm'),
        consistency_review_llm: val('consistency_review_llm'),
      };
      await apiPost('/api/config', current);
      state.config = current;
      showToast('步骤配置已保存', 'success');
    } catch (e) {
      showToast('保存失败: ' + e.message, 'error');
    }
  }

  async function saveProxyConfig() {
    try {
      var current = await apiGet('/api/config');
      current.proxy_setting = {
        enabled: val('proxy_enabled'),
        proxy_url: val('proxy_url'),
        proxy_port: val('proxy_port'),
      };
      await apiPost('/api/config', current);
      state.config = current;
      showToast('代理设置已保存', 'success');
    } catch (e) {
      showToast('保存失败: ' + e.message, 'error');
    }
  }

  // ---- Gather Params ----
  function gatherOtherParams() {
    return {
      topic: val('topic'),
      genre: val('genre'),
      num_chapters: parseInt(val('num_chapters')) || 10,
      word_number: parseInt(val('word_number')) || 3000,
      filepath: val('filepath'),
      chapter_num: val('chapter_num'),
      user_guidance: val('user_guidance'),
      characters_involved: val('characters_involved'),
      key_items: val('key_items'),
      scene_location: val('scene_location'),
      time_constraint: val('time_constraint'),
    };
  }

  function gatherEmbeddingParams() {
    return {
      api_key: val('embedding_api_key'),
      base_url: val('embedding_base_url'),
      model_name: val('embedding_model_name'),
      interface_format: val('embedding_interface_format'),
      retrieval_k: parseInt(val('embedding_retrieval_k')) || 4,
    };
  }

  // ---- Generation Functions ----
  async function generateArchitecture() {
    var filepath = getFilePath();
    if (!filepath) { showToast('请先设置保存路径', 'warning'); return; }
    if (!confirm('确定要生成小说架构吗?')) return;

    setGenerating(true);
    try {
      appendLog('开始生成小说架构...');
      var result = await apiPost('/api/generate/architecture', {
        filepath: filepath,
        llm_config_name: getLLMConfigName('architecture_llm'),
        topic: val('topic'),
        genre: val('genre'),
        num_chapters: parseInt(val('num_chapters')) || 10,
        word_number: parseInt(val('word_number')) || 3000,
        user_guidance: val('user_guidance'),
      });
      if (result.status === 'ok') {
        showToast('小说架构生成完成', 'success');
        appendLog('小说架构生成完成，请在架构页面查看');
      } else {
        showToast('生成失败: ' + (result.message || ''), 'error');
      }
    } catch (e) {
      showToast('生成出错: ' + e.message, 'error');
      appendLog('生成架构出错: ' + e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function generateBlueprint() {
    var filepath = getFilePath();
    if (!filepath) { showToast('请先设置保存路径', 'warning'); return; }
    if (!confirm('确定要生成章节蓝图吗?')) return;

    setGenerating(true);
    try {
      appendLog('开始生成章节蓝图...');
      var result = await apiPost('/api/generate/blueprint', {
        filepath: filepath,
        llm_config_name: getLLMConfigName('chapter_outline_llm'),
        num_chapters: parseInt(val('num_chapters')) || 10,
        user_guidance: val('user_guidance'),
      });
      if (result.status === 'ok') {
        showToast('章节蓝图生成完成', 'success');
        appendLog('章节蓝图生成完成，请在蓝图页面查看');
      } else {
        showToast('生成失败: ' + (result.message || ''), 'error');
      }
    } catch (e) {
      showToast('生成出错: ' + e.message, 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function generateChapter() {
    var filepath = getFilePath();
    if (!filepath) { showToast('请先设置保存路径', 'warning'); return; }

    setGenerating(true);
    try {
      var chapNum = parseInt(val('chapter_num')) || 1;
      appendLog('生成第' + chapNum + '章草稿...');

      // Optionally preview prompt first
      var customPrompt = val('custom_prompt');
      if (customPrompt) {
        appendLog('使用自定义提示词生成...');
      }

      var result = await apiPost('/api/generate/chapter', {
        filepath: filepath,
        llm_config_name: getLLMConfigName('prompt_draft_llm'),
        embedding_config_name: getEmbeddingConfigName(),
        novel_number: chapNum,
        word_number: parseInt(val('word_number')) || 3000,
        user_guidance: val('user_guidance'),
        characters_involved: val('characters_involved'),
        key_items: val('key_items'),
        scene_location: val('scene_location'),
        time_constraint: val('time_constraint'),
        custom_prompt_text: customPrompt || null,
      });
      if (result.status === 'ok') {
        showToast('第' + chapNum + '章草稿生成完成', 'success');
        appendLog('第' + chapNum + '章草稿生成完成');
        if (result.content) {
          setVal('chapterContent', result.content);
        }
      } else {
        showToast('生成失败: ' + (result.message || ''), 'error');
      }
    } catch (e) {
      showToast('生成出错: ' + e.message, 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function finalizeChapter() {
    var filepath = getFilePath();
    if (!filepath) { showToast('请先设置保存路径', 'warning'); return; }
    if (!confirm('确定要定稿当前章节吗?')) return;

    setGenerating(true);
    try {
      var chapNum = parseInt(val('chapter_num')) || 1;
      appendLog('开始定稿第' + chapNum + '章...');

      var result = await apiPost('/api/generate/finalize', {
        filepath: filepath,
        llm_config_name: getLLMConfigName('final_chapter_llm'),
        embedding_config_name: getEmbeddingConfigName(),
        novel_number: chapNum,
        word_number: parseInt(val('word_number')) || 3000,
      });
      if (result.status === 'ok') {
        showToast('第' + chapNum + '章定稿完成', 'success');
        appendLog('第' + chapNum + '章定稿完成');
      } else {
        showToast('定稿失败: ' + (result.message || ''), 'error');
      }
    } catch (e) {
      showToast('定稿出错: ' + e.message, 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function consistencyCheck() {
    var filepath = getFilePath();
    if (!filepath) { showToast('请先设置保存路径', 'warning'); return; }

    setGenerating(true);
    try {
      var chapNum = parseInt(val('chapter_num')) || 1;
      appendLog('开始一致性审校，第' + chapNum + '章...');

      var result = await apiPost('/api/generate/consistency', {
        filepath: filepath,
        llm_config_name: getLLMConfigName('consistency_review_llm'),
        novel_number: chapNum,
      });
      if (result.status === 'ok') {
        showToast('一致性审校完成', 'success');
        if (result.result) {
          appendLog('审校结果: ' + result.result);
        }
      } else {
        showToast('审校失败: ' + (result.message || ''), 'error');
      }
    } catch (e) {
      showToast('审校出错: ' + e.message, 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function batchGenerate() {
    var filepath = getFilePath();
    if (!filepath) { showToast('请先设置保存路径', 'warning'); return; }

    var startStr = prompt('起始章节号:', '1');
    if (!startStr) return;
    var endStr = prompt('结束章节号:', val('num_chapters'));
    if (!endStr) return;

    var start = parseInt(startStr);
    var end = parseInt(endStr);
    if (isNaN(start) || isNaN(end) || start > end) {
      showToast('请输入有效的章节范围', 'error');
      return;
    }

    if (!confirm('确定要批量生成第 ' + start + ' 章到第 ' + end + ' 章吗?')) return;

    setGenerating(true);
    try {
      appendLog('开始批量生成: 第' + start + '章到第' + end + '章...');
      var result = await apiPost('/api/generate/batch', {
        filepath: filepath,
        llm_config_name: getLLMConfigName('prompt_draft_llm'),
        embedding_config_name: getEmbeddingConfigName(),
        start_chapter: start,
        end_chapter: end,
        word_number: parseInt(val('word_number')) || 3000,
        user_guidance: val('user_guidance'),
      });
      if (result.status === 'ok') {
        showToast('批量生成完成', 'success');
        appendLog('批量生成全部完成');
      } else {
        showToast('批量生成失败: ' + (result.message || ''), 'error');
      }
    } catch (e) {
      showToast('批量生成出错: ' + e.message, 'error');
    } finally {
      setGenerating(false);
    }
  }

  // ---- Content Load/Save ----
  var contentTypes = {
    architecture: { loadBtn: 'btnLoadArchitecture', saveBtn: 'btnSaveArchitecture', textarea: 'architectureContent', countId: 'architectureWordCount', file: 'architecture' },
    blueprint: { loadBtn: 'btnLoadBlueprint', saveBtn: 'btnSaveBlueprint', textarea: 'blueprintContent', countId: 'blueprintWordCount', file: 'blueprint' },
    character_state: { loadBtn: 'btnLoadCharState', saveBtn: 'btnSaveCharState', textarea: 'charStateContent', countId: 'charStateWordCount', file: 'character_state' },
    summary: { loadBtn: 'btnLoadSummary', saveBtn: 'btnSaveSummary', textarea: 'summaryContent', countId: 'summaryWordCount', file: 'summary' },
  };

  async function loadContent(type) {
    var filepath = getFilePath();
    if (!filepath) { showToast('请先设置保存路径', 'warning'); return; }
    var info = contentTypes[type];
    if (!info) return;

    try {
      appendLog('加载 ' + type + '...');
      var result = await apiGet('/api/content/' + type + '?filepath=' + encodeURIComponent(filepath));
      setVal(info.textarea, result.content || '');
      var counter = document.getElementById(info.countId);
      if (counter) counter.textContent = '字数：' + countWords(result.content || '');
      appendLog('已加载 ' + type);
    } catch (e) {
      showToast('加载失败: ' + e.message, 'error');
    }
  }

  async function saveContent(type) {
    var filepath = getFilePath();
    if (!filepath) { showToast('请先设置保存路径', 'warning'); return; }
    var info = contentTypes[type];
    if (!info) return;

    try {
      var content = val(info.textarea);
      await apiPost('/api/content/' + type, { filepath: filepath, content: content });
      showToast('已保存 ' + type, 'success');
      appendLog('已保存 ' + type);
    } catch (e) {
      showToast('保存失败: ' + e.message, 'error');
    }
  }

  // ---- Chapter Functions ----
  async function refreshChapters() {
    var filepath = getFilePath();
    if (!filepath) { showToast('请先设置保存路径', 'warning'); return; }

    try {
      var result = await apiGet('/api/chapters?filepath=' + encodeURIComponent(filepath));
      var rawChapters = result.chapters || [];
      // Backend returns objects with number, filename, word_count
      state.chaptersList = rawChapters.map(function(c) { return typeof c === 'object' ? c.number : c; });

      var sel = document.getElementById('chapterSelect');
      sel.innerHTML = '<option value="">选择章节</option>';
      state.chaptersList.forEach(function (num) {
        var o = document.createElement('option');
        o.value = num;
        o.textContent = '第 ' + num + ' 章';
        sel.appendChild(o);
      });

      if (state.chaptersList.length > 0) {
        sel.value = state.chaptersList[0];
        state.currentChapter = state.chaptersList[0];
        loadChapter(state.chaptersList[0]);
      }
      appendLog('已刷新章节列表，共 ' + state.chaptersList.length + ' 章');
    } catch (e) {
      showToast('刷新失败: ' + e.message, 'error');
    }
  }

  async function loadChapter(num) {
    if (!num) return;
    var filepath = getFilePath();
    state.currentChapter = num;

    try {
      var result = await apiGet('/api/chapter/' + num + '?filepath=' + encodeURIComponent(filepath));
      setVal('chapterContent', result.content || '');
      var counter = document.getElementById('chapterWordCount');
      if (counter) counter.textContent = '字数：' + countWords(result.content || '');
    } catch (e) {
      showToast('加载章节失败: ' + e.message, 'error');
    }
  }

  async function saveChapter() {
    var num = state.currentChapter;
    if (!num) { showToast('请先选择章节', 'warning'); return; }
    var filepath = getFilePath();
    if (!filepath) { showToast('请先设置保存路径', 'warning'); return; }

    try {
      await apiPost('/api/chapter/' + num, { filepath: filepath, content: val('chapterContent') });
      showToast('第 ' + num + ' 章已保存', 'success');
      appendLog('已保存第 ' + num + ' 章');
    } catch (e) {
      showToast('保存失败: ' + e.message, 'error');
    }
  }

  function prevChapter() {
    if (!state.chaptersList.length) return;
    var idx = state.chaptersList.indexOf(state.currentChapter);
    if (idx > 0) {
      var prev = state.chaptersList[idx - 1];
      document.getElementById('chapterSelect').value = prev;
      loadChapter(prev);
    } else {
      showToast('已经是第一章了', 'info');
    }
  }

  function nextChapter() {
    if (!state.chaptersList.length) return;
    var idx = state.chaptersList.indexOf(state.currentChapter);
    if (idx < state.chaptersList.length - 1) {
      var next = state.chaptersList[idx + 1];
      document.getElementById('chapterSelect').value = next;
      loadChapter(next);
    } else {
      showToast('已经是最后一章了', 'info');
    }
  }

  // ---- Knowledge Functions ----
  async function importKnowledge() {
    var filepath = getFilePath();
    if (!filepath) { showToast('请先设置保存路径', 'warning'); return; }

    var fileInput = document.getElementById('knowledgeFileInput');
    fileInput.click();

    fileInput.onchange = async function () {
      var file = fileInput.files[0];
      if (!file) return;

      var formData = new FormData();
      formData.append('file', file);
      formData.append('filepath', filepath);
      formData.append('embedding_config_name', getEmbeddingConfigName());

      setGenerating(true);
      try {
        appendLog('正在导入知识库文件: ' + file.name);
        var resp = await fetch(API_BASE + '/api/knowledge/import', {
          method: 'POST',
          body: formData,
        });
        var result = await resp.json();
        if (result.status === 'ok') {
          showToast('知识库导入完成', 'success');
          appendLog('知识库文件导入完成');
        } else {
          showToast('导入失败: ' + (result.message || ''), 'error');
        }
      } catch (e) {
        showToast('导入失败: ' + e.message, 'error');
      } finally {
        setGenerating(false);
        fileInput.value = '';
      }
    };
  }

  async function clearVectorstore() {
    var filepath = getFilePath();
    if (!filepath) { showToast('请先设置保存路径', 'warning'); return; }
    if (!confirm('确定要清空向量库吗? 此操作不可恢复!')) return;
    if (!confirm('二次确认: 真的要删除所有向量数据吗?')) return;

    try {
      var result = await apiPost('/api/knowledge/clear', { filepath: filepath });
      if (result.status === 'ok') {
        showToast('向量库已清空', 'success');
        appendLog('已清空向量库');
      } else {
        showToast('清空失败', 'error');
      }
    } catch (e) {
      showToast('操作失败: ' + e.message, 'error');
    }
  }

  // ---- Role Functions ----
  async function loadRoleCategories() {
    var filepath = getFilePath();
    if (!filepath) return;

    try {
      var result = await apiGet('/api/roles/categories?filepath=' + encodeURIComponent(filepath));
      var categories = result.categories || [];

      var tabBar = document.getElementById('roleCategoryTabs');
      tabBar.innerHTML = '';
      var allTab = document.createElement('button');
      allTab.className = 'tab-item active';
      allTab.setAttribute('data-category', '全部');
      allTab.textContent = '全部';
      tabBar.appendChild(allTab);

      categories.forEach(function (cat) {
        var tab = document.createElement('button');
        tab.className = 'tab-item';
        tab.setAttribute('data-category', cat);
        tab.textContent = cat;
        tabBar.appendChild(tab);
      });

      // Bind click
      tabBar.querySelectorAll('.tab-item').forEach(function (tab) {
        tab.addEventListener('click', function () {
          tabBar.querySelectorAll('.tab-item').forEach(function (t) { t.classList.remove('active'); });
          tab.classList.add('active');
          state.currentRoleCategory = tab.getAttribute('data-category');
          loadRoleList(state.currentRoleCategory);
        });
      });

      loadRoleList('全部');
    } catch (e) {
      // Silently fail - may not have roles yet
    }
  }

  async function loadRoleList(category) {
    var filepath = getFilePath();
    if (!filepath) return;

    try {
      var result = await apiGet('/api/roles/list/' + encodeURIComponent(category) + '?filepath=' + encodeURIComponent(filepath));
      var roles = result.roles || [];

      var panel = document.getElementById('roleListPanel');
      panel.innerHTML = '';

      if (roles.length === 0) {
        panel.innerHTML = '<div class="empty-state"><p>暂无角色</p></div>';
        return;
      }

      roles.forEach(function (role) {
        var div = document.createElement('div');
        div.className = 'chapter-list-item';
        div.textContent = role;
        div.addEventListener('click', function () {
          panel.querySelectorAll('.chapter-list-item').forEach(function (r) { r.classList.remove('active'); });
          div.classList.add('active');
          loadRoleContent(category, role);
        });
        panel.appendChild(div);
      });
    } catch (e) {
      // Silently fail
    }
  }

  async function loadRoleContent(category, name) {
    var filepath = getFilePath();
    try {
      var result = await apiGet('/api/roles/content?filepath=' + encodeURIComponent(filepath) + '&category=' + encodeURIComponent(category) + '&name=' + encodeURIComponent(name));
      setVal('roleName', result.name || name);
      setVal('roleContent', result.content || '');
    } catch (e) {
      // silently
    }
  }

  async function saveRole() {
    var filepath = getFilePath();
    if (!filepath) { showToast('请先设置保存路径', 'warning'); return; }

    try {
      await apiPost('/api/roles/save', {
        filepath: filepath,
        category: state.currentRoleCategory,
        role_name: val('roleName'),
        content: val('roleContent'),
      });
      showToast('角色已保存', 'success');
      appendLog('已保存角色: ' + val('roleName'));
      loadRoleList(state.currentRoleCategory);
    } catch (e) {
      showToast('保存失败: ' + e.message, 'error');
    }
  }

  async function deleteRole() {
    var name = val('roleName');
    if (!name) return;
    if (!confirm('确定要删除角色 "' + name + '" 吗?')) return;

    var filepath = getFilePath();
    try {
      await apiDelete('/api/roles/delete?filepath=' + encodeURIComponent(filepath) + '&category=' + encodeURIComponent(state.currentRoleCategory) + '&name=' + encodeURIComponent(name));
      showToast('角色已删除', 'success');
      setVal('roleName', '');
      setVal('roleContent', '');
      loadRoleList(state.currentRoleCategory);
    } catch (e) {
      showToast('删除失败: ' + e.message, 'error');
    }
  }

  // ---- Collapsible Sections ----
  function setupCollapsibles() {
    var toggle = $('#optionalParamsToggle');
    var body = $('#optionalParamsBody');
    if (toggle && body) {
      toggle.addEventListener('click', function () {
        toggle.classList.toggle('open');
        body.classList.toggle('open');
      });
    }

    var toggle2 = $('#customPromptToggle');
    var body2 = $('#customPromptBody');
    if (toggle2 && body2) {
      toggle2.addEventListener('click', function () {
        toggle2.classList.toggle('open');
        body2.classList.toggle('open');
      });
    }
  }

  // ---- Save All Config ----
  async function saveAllConfig() {
    try {
      var current = await apiGet('/api/config');

      current.other_params = gatherOtherParams();

      var configName = val('llmConfigSelect');
      if (configName && current.llm_configs && current.llm_configs[configName]) {
        current.llm_configs[configName] = {
          api_key: val('api_key'),
          base_url: val('base_url'),
          model_name: val('model_name'),
          interface_format: val('interface_format'),
          temperature: parseFloat(val('temperature')) || 0.7,
          max_tokens: parseInt(val('max_tokens')) || 8192,
          timeout: parseInt(val('timeout')) || 600,
        };
      }

      current.embedding_configs = current.embedding_configs || {};
      current.embedding_configs[val('embeddingConfigSelect')] = gatherEmbeddingParams();

      current.proxy_setting = {
        enabled: val('proxy_enabled'),
        proxy_url: val('proxy_url'),
        proxy_port: val('proxy_port'),
      };

      await apiPost('/api/config', current);
      state.config = current;
      showToast('所有配置已保存', 'success');
      appendLog('所有配置已保存');
    } catch (e) {
      showToast('保存失败: ' + e.message, 'error');
    }
  }

  // ---- Initialization ----
  async function init() {
    appendLog('应用初始化中...');

    // Load config
    try {
      var config = await apiGet('/api/config');
      populateForm(config);
      appendLog('配置加载完成');
    } catch (e) {
      appendLog('配置加载失败: ' + e.message + ' (请确认后端服务已启动)');
    }

    // Connect WebSocket
    connectWebSocket();

    // Setup word counters
    setupWordCount('architectureContent', 'architectureWordCount');
    setupWordCount('blueprintContent', 'blueprintWordCount');
    setupWordCount('charStateContent', 'charStateWordCount');
    setupWordCount('summaryContent', 'summaryWordCount');
    setupWordCount('chapterContent', 'chapterWordCount');

    // Setup collapsibles
    setupCollapsibles();

    // Bind nav items
    $$('.nav-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var view = item.getAttribute('data-view');
        if (view) switchView(view);
      });
    });

    // Bind log panel
    document.getElementById('btnClearLog').addEventListener('click', clearLog);
    document.getElementById('btnToggleLog').addEventListener('click', function () {
      document.getElementById('logPanel').classList.toggle('collapsed');
      this.textContent = document.getElementById('logPanel').classList.contains('collapsed') ? '展开' : '收起';
    });

    // Bind generation buttons
    document.getElementById('btnGenerateArchitecture').addEventListener('click', generateArchitecture);
    document.getElementById('btnGenerateBlueprint').addEventListener('click', generateBlueprint);
    document.getElementById('btnGenerateChapter').addEventListener('click', generateChapter);
    document.getElementById('btnFinalizeChapter').addEventListener('click', finalizeChapter);
    document.getElementById('btnConsistencyCheck').addEventListener('click', consistencyCheck);
    document.getElementById('btnImportKnowledge').addEventListener('click', importKnowledge);
    document.getElementById('btnClearVectorstore').addEventListener('click', clearVectorstore);
    document.getElementById('btnBatchGenerate').addEventListener('click', batchGenerate);

    document.getElementById('btnPlotArcs').addEventListener('click', async function () {
      var filepath = getFilePath();
      if (!filepath) { showToast('请先设置保存路径', 'warning'); return; }
      try {
        var result = await apiGet('/api/content/plot_arcs?filepath=' + encodeURIComponent(filepath));
        if (result.content && result.content.trim()) {
          appendLog('剧情要点:\n' + result.content);
          showToast('剧情要点已输出到日志面板', 'info');
        } else {
          showToast('暂无剧情要点记录', 'info');
        }
      } catch (e) {
        showToast('加载失败: ' + e.message, 'error');
      }
    });

    // Browse button (not supported in web, show info)
    document.getElementById('btnBrowse').addEventListener('click', function () {
      var path = prompt('请输入保存路径:', val('filepath') || '');
      if (path !== null) setVal('filepath', path);
    });

    // Config buttons
    document.getElementById('llmConfigSelect').addEventListener('change', function () {
      loadLLMConfigFields(this.value);
    });
    document.getElementById('btnAddConfig').addEventListener('click', addLLMConfig);
    document.getElementById('btnDeleteConfig').addEventListener('click', deleteLLMConfig);
    document.getElementById('btnRenameConfig').addEventListener('click', renameLLMConfig);
    document.getElementById('btnSaveLLMConfig').addEventListener('click', saveLLMConfig);
    document.getElementById('btnTestLLM').addEventListener('click', testLLM);

    // Embedding config buttons
    document.getElementById('embeddingConfigSelect').addEventListener('change', function () {
      loadEmbeddingConfigFields(this.value);
    });
    document.getElementById('btnAddEmbConfig').addEventListener('click', addEmbeddingConfig);
    document.getElementById('btnDeleteEmbConfig').addEventListener('click', deleteEmbeddingConfig);
    document.getElementById('btnRenameEmbConfig').addEventListener('click', renameEmbeddingConfig);
    document.getElementById('btnTestEmbedding').addEventListener('click', testEmbedding);
    document.getElementById('btnSaveStepConfig').addEventListener('click', saveStepConfig);
    document.getElementById('btnSaveProxy').addEventListener('click', saveProxyConfig);

    // Temperature slider
    var tempSlider = document.getElementById('temperature');
    var tempValue = document.getElementById('temperatureValue');
    if (tempSlider && tempValue) {
      tempSlider.addEventListener('input', function () {
        tempValue.textContent = parseFloat(this.value).toFixed(2);
      });
    }

    // Content load/save buttons
    Object.keys(contentTypes).forEach(function (type) {
      var info = contentTypes[type];
      var loadBtn = document.getElementById(info.loadBtn);
      var saveBtn = document.getElementById(info.saveBtn);
      if (loadBtn) loadBtn.addEventListener('click', function () { loadContent(type); });
      if (saveBtn) saveBtn.addEventListener('click', function () { saveContent(type); });
    });

    // Chapter buttons
    document.getElementById('btnRefreshChapters').addEventListener('click', refreshChapters);
    document.getElementById('btnSaveChapter').addEventListener('click', saveChapter);
    document.getElementById('btnPrevChapter').addEventListener('click', prevChapter);
    document.getElementById('btnNextChapter').addEventListener('click', nextChapter);
    document.getElementById('chapterSelect').addEventListener('change', function () {
      if (this.value) loadChapter(this.value);
    });

    // Role buttons
    document.getElementById('btnSaveRole').addEventListener('click', saveRole);
    document.getElementById('btnDeleteRole').addEventListener('click', deleteRole);

    // Settings buttons
    document.getElementById('btnLangChinese').addEventListener('click', function () {
      showToast('已切换到中文模式', 'info');
    });
    document.getElementById('btnLangEnglish').addEventListener('click', function () {
      showToast('Switched to English mode', 'info');
    });

    // Mobile menu
    document.getElementById('mobileMenuBtn').addEventListener('click', function () {
      document.getElementById('sidebar').classList.toggle('open');
    });

    // Embedding interface change
    document.getElementById('embedding_interface_format').addEventListener('change', function () {
      var format = this.value;
      var defaults = {
        'OpenAI': { url: 'https://api.openai.com/v1', model: 'text-embedding-ada-002' },
        'DeepSeek': { url: 'https://api.deepseek.com/v1', model: '' },
        'Azure OpenAI': { url: 'https://[az].openai.azure.com/openai/deployments/[model]/embeddings?api-version=2023-05-15', model: '' },
        'Gemini': { url: 'https://generativelanguage.googleapis.com/v1beta/', model: 'models/text-embedding-004' },
        'Ollama': { url: 'http://localhost:11434/api', model: '' },
        'ML Studio': { url: 'http://localhost:1234/v1', model: '' },
        'SiliconFlow': { url: 'https://api.siliconflow.cn/v1/embeddings', model: 'BAAI/bge-m3' },
      };
      if (defaults[format]) {
        setVal('embedding_base_url', defaults[format].url);
        setVal('embedding_model_name', defaults[format].model);
      }
    });

    // LLM interface format presets: auto-fill base_url / model_name hints
    document.getElementById('interface_format').addEventListener('change', function () {
      var format = this.value;
      var defaults = {
        'OpenAI': { url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
        'DeepSeek': { url: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
        'Gemini': { url: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.5-flash' },
        'Azure OpenAI': { url: 'https://<resource>.openai.azure.com/openai/deployments/<deployment>/chat/completions?api-version=2024-02-15-preview', model: '' },
        'Azure AI': { url: 'https://<name>.services.ai.azure.com/models/chat/completions?api-version=2024-05-01-preview', model: '' },
        'Ollama': { url: 'http://localhost:11434/v1', model: 'llama3.1' },
        'ML Studio': { url: 'http://localhost:1234/v1', model: '' },
        '阿里云百炼': { url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
        '火山引擎': { url: 'https://ark.cn-beijing.volces.com/api/v3', model: '' },
        '硅基流动': { url: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V3' },
        'Grok': { url: 'https://api.x.ai/v1', model: 'grok-2' },
      };
      if (defaults[format]) {
        setVal('base_url', defaults[format].url);
        setVal('model_name', defaults[format].model);
      }
    });

    // Refresh step config
    document.getElementById('btnRefreshStepConfig').addEventListener('click', async function () {
      try {
        var config = await apiGet('/api/config');
        state.config = config;
        var names = Object.keys(config.llm_configs || {});
        populateStepConfigSelects(names, config.choose_configs || {});
        showToast('已刷新步骤配置', 'success');
      } catch (e) {
        showToast('刷新失败: ' + e.message, 'error');
      }
    });

    // WebDAV buttons
    document.getElementById('btnTestWebDAV').addEventListener('click', function () {
      showToast('WebDAV 功能即将推出', 'info');
    });
    document.getElementById('btnBackupWebDAV').addEventListener('click', function () {
      showToast('WebDAV 功能即将推出', 'info');
    });
    document.getElementById('btnRestoreWebDAV').addEventListener('click', function () {
      showToast('WebDAV 功能即将推出', 'info');
    });

    appendLog('应用初始化完成');
  }

  // ---- Bootstrap ----
  document.addEventListener('DOMContentLoaded', init);

})();
