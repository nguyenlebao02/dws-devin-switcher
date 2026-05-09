import { Command } from 'commander';
import packageJson from '../../package.json';
import { runAdd } from './commands/add';
import { runDefault } from './commands/default';
import { runDoctor } from './commands/doctor';
import { runList } from './commands/list';
import { runLogin } from './commands/login';
import { runQuota } from './commands/quota';
import { runRemove } from './commands/remove';
import { runUpdate } from './commands/update';
import { runUse } from './commands/use';
import { runWeb } from './commands/web';

const HELP_TOKENS = new Set(['help', '--help', '-h', '--version', '-V']);
const REMOVED_TOKENS = new Set(['next']);

function buildProgram(): Command {
  const program = new Command();
  program
    .name('dsw')
    .description('Devin CLI account switcher: rotate between accounts and run devin under each.')
    .version(packageJson.version);

  program.addHelpText(
    'after',
    `\nExamples:\n  $ dsw                 Check quota, pick the max remaining account, and run devin\n  $ dsw use work        Run devin using the 'work' account\n  $ dsw use work -p "fix bug"\n  $ dsw -p "fix bug"    Forward args to devin (anything not a subcommand is passed through)\n  $ dsw list            Show all accounts\n  $ dsw quota           Show quota/usage for all ready accounts\n  $ dsw add             Create a profile and infer its account name after login\n  $ dsw add work        Create the 'work' profile and run devin auth login\n  $ dsw login work      Re-run devin auth login for 'work'\n  $ dsw remove work --yes\n  $ dsw update          Update this dsw install\n`
  );

  program
    .command('list')
    .alias('ls')
    .description('List configured Devin accounts')
    .action(() => {
      runList();
    });

  program
    .command('add')
    .description('Add a new Devin account and run `devin auth login` for it')
    .argument('[name]', 'Account name (letters, numbers, _, -). If omitted, inferred after login.')
    .action(async (name: string | undefined) => {
      await runAdd(name);
    });

  program
    .command('remove')
    .alias('rm')
    .description('Remove an account and delete its profile credentials')
    .argument('<name>', 'Account name')
    .option('--yes', 'Confirm removal (required)')
    .action((name: string, options: { yes?: boolean }) => {
      runRemove(name, options);
    });

  program
    .command('login')
    .description('Re-run `devin auth login` for an existing account')
    .argument('<name>', 'Account name')
    .action(async (name: string) => {
      await runLogin(name);
    });

  program
    .command('use')
    .description('Run devin using a specific account')
    .allowUnknownOption(true)
    .argument('<name>', 'Account name')
    .argument('[args...]', 'Arguments to forward to devin')
    .action(async (name: string, args: string[]) => {
      await runUse({ name, args });
    });

  program
    .command('quota')
    .description('Check usage/quota for all configured Devin accounts')
    .action(async () => {
      await runQuota();
    });

  program
    .command('update')
    .description('Update this dsw install')
    .option('--dry-run', 'Print update commands without running them')
    .action(async (options: { dryRun?: boolean }) => {
      await runUpdate({ dryRun: options.dryRun });
    });

  program
    .command('doctor')
    .description('Print local paths and verify devin CLI is available')
    .action(async () => {
      await runDoctor();
    });

  program
    .command('web')
    .description('Start the Devin Switcher web dashboard')
    .option('-p, --port <port>', 'Port to listen on', '3456')
    .option('-H, --host <host>', 'Host to bind to', '127.0.0.1')
    .option('--open', 'Open browser automatically')
    .action(async (options) => {
      await runWeb({
        port: Number(options.port),
        host: options.host,
        open: options.open,
      });
    });

  return program;
}

function knownTokens(program: Command): Set<string> {
  const tokens = new Set<string>(HELP_TOKENS);
  for (const command of program.commands) {
    tokens.add(command.name());
    for (const alias of command.aliases()) tokens.add(alias);
  }
  return tokens;
}

export async function main(argv = process.argv): Promise<void> {
  const args = argv.slice(2);
  const program = buildProgram();
  const first = args[0];

  if (first && REMOVED_TOKENS.has(first)) {
    console.error('dsw: `dsw next` has been removed. Run `dsw` instead for quota-aware account selection.');
    process.exitCode = 1;
    return;
  }

  if (!first || !knownTokens(program).has(first)) {
    await runDefault({ args });
    return;
  }

  await program.parseAsync(argv);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`dsw: ${message}`);
    process.exitCode = 1;
  });
}
