const { Editor } = require('@tiptap/core');
const StarterKit = require('@tiptap/starter-kit').default;
const Color = require('@tiptap/extension-color').default;
const TextStyle = require('@tiptap/extension-text-style').default;

const editor = new Editor({
  extensions: [StarterKit, TextStyle, Color],
  content: '<p>Normal paragraph text</p>'
});
console.log(editor.getHTML());
