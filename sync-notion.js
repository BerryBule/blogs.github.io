const { Client } = require('@notionhq/client');
const fs = require('fs').promises;
const path = require('path');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

async function syncNotionToGitHub() {
  try {
    await fs.mkdir(path.join(__dirname, 'notion-notes'), { recursive: true });
    const response = await notion.databases.query({ database_id: DATABASE_ID });
    const notesList = [];

    for (const page of response.results) {
      // 兼容多种标题属性名
      let title = 'Untitled';
      for (const key of ['Title', '标题', '名称', 'Name']) {
        if (page.properties[key]?.title?.[0]?.plain_text) {
          title = page.properties[key].title[0].plain_text;
          break;
        }
      }
      // 文件名处理
      const fileName = `${title.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[\/\\?%*:|"<>]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
      }.md`;

      // 获取内容
      const blocks = await notion.blocks.children.list({ block_id: page.id });
      const markdown = await convertToMarkdown(blocks.results);

      await fs.writeFile(
        path.join(__dirname, 'notion-notes', fileName),
        markdown
      );
      notesList.push(`* [${title}](${fileName})`);
    }

    // 生成 README.md
    const readmeContent = `# Notion 同步笔记\n\n这里是从 Notion 自动同步的笔记内容。\n\n## 笔记列表\n\n${notesList.join('\n')}\n`;
    await fs.writeFile(
      path.join(__dirname, 'notion-notes', 'README.md'),
      readmeContent
    );
    console.log('同步完成！');
  } catch (error) {
    console.error('同步失败:', error);
    process.exit(1);
  }
}

async function convertToMarkdown(blocks) {
  let markdown = '';
  for (const block of blocks) {
    switch (block.type) {
      case 'paragraph':
        markdown += block.paragraph.rich_text.map(text => text.plain_text).join('') + '\n\n';
        break;
      case 'heading_1':
        markdown += '# ' + block.heading_1.rich_text.map(text => text.plain_text).join('') + '\n\n';
        break;
      case 'heading_2':
        markdown += '## ' + block.heading_2.rich_text.map(text => text.plain_text).join('') + '\n\n';
        break;
      case 'heading_3':
        markdown += '### ' + block.heading_3.rich_text.map(text => text.plain_text).join('') + '\n\n';
        break;
      case 'bulleted_list_item':
        markdown += '* ' + block.bulleted_list_item.rich_text.map(text => text.plain_text).join('') + '\n';
        break;
      case 'numbered_list_item':
        markdown += '1. ' + block.numbered_list_item.rich_text.map(text => text.plain_text).join('') + '\n';
        break;
      case 'code':
        markdown += '```' + (block.code.language || '') + '\n' +
          block.code.rich_text.map(text => text.plain_text).join('') +
          '\n```\n\n';
        break;
    }
  }
  return markdown;
}

syncNotionToGitHub();