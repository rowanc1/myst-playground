import { unified } from 'unified';
import { mystParser } from 'myst-parser';
import { State, transform, mystToHast, formatHtml } from 'myst-to-html';
import rehypeStringify from 'rehype-stringify';

const pipe = unified()
  .use(mystParser)
  .use(transform, new State())
  .use(mystToHast)
  .use(formatHtml)
  .use(rehypeStringify);

const file = pipe.processSync(':::{important}\nHello to the world!\n:::');
console.log(file.value);
// <aside class="admonition important"><p class="admonition-title">Important</p><p>Hello to the world!</p></aside>
