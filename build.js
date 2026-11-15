// 把 src/ 下的各部分拼成单文件页面：node build.js
const fs = require('fs'), path = require('path');
const r = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const engine = [r('iberia.js'), r('ops.js'), r('skills.js'), r('ops2.js'), r('stats.js'), r('engine.js'), r('bosses.js'), r('notes.js')].join('\n');
// 头像（来自 PRTS 的游戏素材，压成 112px WebP 后内嵌）
const avDir = path.join(__dirname, 'src', 'avatars');
const avatars = {};
if (fs.existsSync(avDir)) for (const f of fs.readdirSync(avDir)) if (f.endsWith('.webp')) avatars[f.slice(0, -5)] = 'data:image/webp;base64,' + fs.readFileSync(path.join(avDir, f)).toString('base64');
// 领袖图片（同样来自 PRTS，144px WebP）
const bossDir = path.join(__dirname, 'src', 'bossimg');
const bossImg = {};
if (fs.existsSync(bossDir)) for (const f of fs.readdirSync(bossDir)) if (f.endsWith('.webp')) bossImg[f.slice(0, -5)] = 'data:image/webp;base64,' + fs.readFileSync(path.join(bossDir, f)).toString('base64');
const html = `<title>卫戍协议伤害计算器</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
${r('style.css')}</style>
${r('body.html')}
<script>
const AVATARS = ${JSON.stringify(avatars)};
const BOSS_IMG = ${JSON.stringify(bossImg)};
</script>
<script>
/*ENGINE-START*/
${engine}
/*ENGINE-END*/
</script>

<script>
${r('ui.js')}
</script>
`;
fs.writeFileSync(path.join(__dirname, 'weishu-calc.html'), html);
// 本地预览用（发布的页面由平台补全 doctype 和 charset）
const standalone = '<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<style>body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n</head>\n<body>\n' + html + '</body>\n</html>\n';
fs.writeFileSync(path.join(__dirname, 'preview.html'), standalone);
// 独立网页：双击即可在浏览器打开，不依赖网络，也可以直接上传到任何静态网站托管
fs.writeFileSync(path.join(__dirname, '卫戍协议伤害计算器.html'), standalone);
// GitHub Pages 用的入口文件
fs.writeFileSync(path.join(__dirname, 'index.html'), standalone);
console.log('built', html.length, 'chars');
