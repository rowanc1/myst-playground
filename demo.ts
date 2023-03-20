import { visit } from 'unist-util-visit';
import { unified } from 'unified';
import { VFile } from 'vfile';
import yaml from 'js-yaml';
import { mystParse } from 'myst-parser';
import { validatePageFrontmatter } from 'myst-frontmatter';
import type { PageFrontmatter } from 'myst-frontmatter';
import {
  mathPlugin,
  footnotesPlugin,
  keysPlugin,
  basicTransformationsPlugin,
  enumerateTargetsPlugin,
  resolveReferencesPlugin,
  WikiTransformer,
  GithubTransformer,
  DOITransformer,
  RRIDTransformer,
  linksPlugin,
  ReferenceState,
  getFrontmatter,
} from 'myst-transforms';
import mystToTex from 'myst-to-tex';
import mystToJats from 'myst-to-jats';
import { mystToHtml } from 'myst-to-html';
import type { LatexResult } from 'myst-to-tex';
import type { JatsResult } from 'myst-to-jats';

async function parse(text: string, defaultFrontmatter?: PageFrontmatter) {
  // Ensure that any imports from myst are async and scoped to this function
  const file = new VFile();
  const mdast = mystParse(text, {
    markdownit: { linkify: true },
    // directives: [cardDirective, gridDirective, ...tabDirectives],
    // roles: [reactiveRole],
    vfile: file,
  });
  const linkTransforms = [
    new WikiTransformer(),
    new GithubTransformer(),
    new DOITransformer(),
    new RRIDTransformer(),
  ];
  // For the mdast that we show, duplicate, strip positions and dump to yaml
  // Also run some of the transforms, like the links
  const mdastPre = JSON.parse(JSON.stringify(mdast));
  unified().use(linksPlugin, { transformers: linkTransforms }).runSync(mdastPre);
  visit(mdastPre, (n) => delete n.position);
  const mdastString = yaml.dump(mdastPre);
  const htmlString = mystToHtml(mdastPre);
  const references = {
    cite: { order: [], data: {} },
    footnotes: {},
  };
  const { frontmatter: frontmatterRaw } = getFrontmatter(mdast, {
    removeYaml: true,
    removeHeading: false,
  });
  const frontmatter = validatePageFrontmatter(frontmatterRaw, {
    property: 'frontmatter',
    messages: {},
  });
  const state = new ReferenceState({
    numbering: frontmatter.numbering ?? defaultFrontmatter?.numbering,
    file,
  });
  unified()
    .use(basicTransformationsPlugin)
    .use(mathPlugin, { macros: frontmatter?.math ?? {} }) // This must happen before enumeration, as it can add labels
    .use(enumerateTargetsPlugin, { state })
    .use(linksPlugin, { transformers: linkTransforms })
    .use(footnotesPlugin, { references })
    .use(resolveReferencesPlugin, { state })
    .use(keysPlugin)
    .runSync(mdast as any, file);
  const texFile = new VFile();
  const tex = unified()
    .use(mystToTex, { references })
    .stringify(mdast as any, texFile).result as LatexResult;
  const jatsFile = new VFile();
  const jats = unified()
    .use(mystToJats, { spaces: 2 })
    .stringify(mdast as any, jatsFile).result as JatsResult;
  return {
    frontmatter,
    yaml: mdastString,
    references: { ...references, article: mdast },
    html: htmlString,
    tex: tex.value,
    texWarnings: texFile.messages,
    jats: jats.value,
    jatsWarnings: jatsFile.messages,
    warnings: file.messages,
  };
}

parse(':::{important}\nHello to the world!\n:::').then((d) => console.log(d));
