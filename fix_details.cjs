const fs = require('fs');
const file = 'src/pages/admin/reviews/ReviewDetails.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('import { Textarea } from "../../../components/ui/textarea";', '');
content = content.replace(/<Textarea/g, '<textarea');
content = content.replace(/<\/Textarea>/g, '</textarea>');

content = content.replace('import {  ArrowLeft,', 'import {  ArrowLeft, MessageSquare, Save,');

fs.writeFileSync(file, content);
console.log("Fixed ReviewDetails");
