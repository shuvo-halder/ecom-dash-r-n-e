const str = 'color: #64748b';
const replaced = str.replace(/color:\s*(?![#][0-9a-fA-F]{3,6}\b)[^;]+(;|$)/gi, '');
console.log("Original:", str, "Replaced:", replaced);
