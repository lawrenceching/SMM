/**
 * Copy the directory structure from the source to the destination.
 * 
 * Usage:
 *   bun copy-folder-structure.ts --from /path/to/source --to /tmp
 * 
 */
import fs from 'fs';
import path from 'path';

interface CommandLineArgs {
  from: string;
  to: string;
}

function parseCommandLineArgs(): CommandLineArgs {
  const args = process.argv.slice(2);
  const parsedArgs: Partial<CommandLineArgs> = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];

    if (key === '--from') {
      parsedArgs.from = value;
    } else if (key === '--to') {
      parsedArgs.to = value;
    }
  }

  if (!parsedArgs.from || !parsedArgs.to) {
    throw new Error('Both --from and --to arguments are required');
  }

  return parsedArgs as CommandLineArgs;
}

function copyDirectoryStructure(source: string, destination: string): void {
  // 确保源目录存在
  if (!fs.existsSync(source)) {
    throw new Error(`Source directory does not exist: ${source}`);
  }

  // 获取源目录的基本名称
  const sourceBaseName = path.basename(source);
  const targetRoot = path.join(destination, sourceBaseName);

  // 创建目标根目录
  fs.mkdirSync(targetRoot, { recursive: true });

  // 递归处理目录
  function processDirectory(currentSource: string, currentTarget: string): void {
    const items = fs.readdirSync(currentSource, { withFileTypes: true });

    for (const item of items) {
      const sourcePath = path.join(currentSource, item.name);
      const targetPath = path.join(currentTarget, item.name);

      if (item.isDirectory()) {
        // 如果是目录，创建目录并递归处理
        fs.mkdirSync(targetPath, { recursive: true });
        processDirectory(sourcePath, targetPath);
      } else if (item.isFile()) {
        // 如果是文件，创建空文件
        fs.writeFileSync(targetPath, '');
      }
      // 忽略符号链接等其他类型
    }
  }

  processDirectory(source, targetRoot);
}

function main(): void {
  try {
    const { from, to } = parseCommandLineArgs();
    console.log(`Copying directory structure from ${from} to ${to}`);
    copyDirectoryStructure(from, to);
    console.log('Directory structure copied successfully');
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();