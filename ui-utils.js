(function (root, factory) {
  const uiUtils = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = uiUtils;
  if (root) root.FoxholeUI = uiUtils;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const htmlEscapes = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => htmlEscapes[character]);
  }

  function displayItemName(codeName, items) {
    return items?.[codeName]?.displayName || codeName;
  }

  return { displayItemName, escapeHtml };
});
