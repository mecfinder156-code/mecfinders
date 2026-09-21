const fs = require('fs');
const path = require('path');

const catFile = path.join(__dirname, 'app/dashboard/categories/page.tsx');
let catCode = fs.readFileSync(catFile, 'utf8');
catCode = catCode.replace('setCategories(res.data.data);', 'setCategories(res.data.data.categories || []);');
catCode = catCode.replace(/description: '', icon: ''/g, "emoji: ''");
catCode = catCode.replace(/description: e\.target\.value/g, "emoji: e.target.value");
catCode = catCode.replace(/Description \(Optional\)/g, "Emoji");
catCode = catCode.replace(/<textarea[\\s\\S]*?<\\/textarea>/g, '<input type="text" required value={formData.emoji} onChange={(e) => setFormData({ ...formData, emoji: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />');
catCode = catCode.replace('<th className="px-6 py-4 font-medium text-gray-900">Description</th>', '<th className="px-6 py-4 font-medium text-gray-900">Emoji</th>');
catCode = catCode.replace('<td className="px-6 py-4 text-gray-500">{category.description || \'-\'}</td>', '<td className="px-6 py-4 text-xl">{category.emoji}</td>');
fs.writeFileSync(catFile, catCode);

const cityFile = path.join(__dirname, 'app/dashboard/cities/page.tsx');
let cityCode = fs.readFileSync(cityFile, 'utf8');
cityCode = cityCode.replace('setCities(res.data.data);', 'setCities(res.data.data.cities || []);');
cityCode = cityCode.replace(/, state: ''/g, "");
cityCode = cityCode.replace(/<th className="px-6 py-4 font-medium text-gray-900">State<\\/th>/g, "");
cityCode = cityCode.replace(/<td className="px-6 py-4 text-gray-500">{city.state}<\\/td>/g, "");
cityCode = cityCode.replace(/<div>\\s*<label className="block text-sm font-medium text-gray-700 mb-1">State<\\/label>[\\s\\S]*?<\\/div>/g, "");
fs.writeFileSync(cityFile, cityCode);

const svcFile = path.join(__dirname, 'app/dashboard/service-setup/[categoryId]/[cityId]/page.tsx');
let svcCode = fs.readFileSync(svcFile, 'utf8');
svcCode = svcCode.replace('setServices(res.data.data);', 'setServices(res.data.data.services || []);');
fs.writeFileSync(svcFile, svcCode);

const catIdFile = path.join(__dirname, 'app/dashboard/service-setup/[categoryId]/page.tsx');
let catIdCode = fs.readFileSync(catIdFile, 'utf8');
catIdCode = catIdCode.replace('setCities(res.data.data);', 'setCities(res.data.data.cities || []);');
fs.writeFileSync(catIdFile, catIdCode);

const setupFile = path.join(__dirname, 'app/dashboard/service-setup/page.tsx');
let setupCode = fs.readFileSync(setupFile, 'utf8');
setupCode = setupCode.replace('setCategories(res.data.data);', 'setCategories(res.data.data.categories || []);');
setupCode = setupCode.replace(/category\.icon/g, 'category.emoji');
fs.writeFileSync(setupFile, setupCode);

console.log('UI files fixed.');
