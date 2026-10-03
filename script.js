(() => {
  "use strict";

  const TARGET_HASH = "$1$max$yefFk99s23k4j4b2h2s3V.";
  const INTERNAL_IP = "172.16.20.20";
  const FLAGS = {
    1: "flag{web_enumeration_mastery}",
    2: "flag{realistic_privesc_pathway}",
    3: "flag{internal_pivoting_achieved}",
    4: "flag{leviathan_protocol_terminated}",
  };

  const targetFilesystem = {
    "/": {
      etc: {
        passwd: {
          content: "root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nleakuser:x:1000:1000:Leak User,,,:/home/leakuser:/bin/bash",
        },
        shadow: {
          content: `root:$6$salt$longhashvaluehere\nleakuser:${TARGET_HASH}:18632:0:99999:7:::`,
          rootOnly: true,
        },
        ssh: {
          sshd_config: {
            content: "PermitRootLogin no\nPasswordAuthentication no\nPubkeyAuthentication yes",
          },
        },
      },
      home: {
        leakuser: {
          ".bash_history": {
            content: "sudo apt update\n/usr/local/bin/bkup_util\nssh dev@172.16.20.20",
          },
          documents: {
            "notes.txt": {
              content: "Lembretes:\n- Terminar relatório do projeto Leviathan.\n- Trocar a senha do roteador.\n- Revisar a captura de rede.",
            },
          },
          "capture.pcap": {
            content: "[captura de pacotes binária]",
            special: "pcap",
          },
        },
      },
      root: {
        "flag2.txt": { content: FLAGS[2], rootOnly: true },
        "setup.sh": {
          content: "#!/bin/sh\nchmod u+s /usr/local/bin/bkup_util",
          rootOnly: true,
        },
      },
      usr: {
        local: {
          bin: {
            bkup_util: {
              content: "[binário executável SUID]",
              special: "suid",
            },
          },
        },
      },
      var: {
        www: {
          html: {
            "index.html": { content: "<h1>Servidor Web Padrão</h1>" },
            dev: {
              "index.html": { content: "Área de desenvolvimento" },
              "utils.php": {
                content: "<?php system($_GET['cmd'] ?? ''); ?>",
                special: "rce",
              },
            },
          },
        },
      },
    },
  };

  const internalFilesystem = {
    "/": {
      home: {
        dev: {
          "flag3.txt": { content: FLAGS[3] },
          "rpc_client": { content: "[cliente RPC]" },
          "README.md": {
            content: "O cliente local conversa com o Leviathan Protocol (customRPC) na porta 1337.",
          },
        },
      },
      srv: {
        "flag_final.txt": { content: FLAGS[4], rootOnly: true },
      },
    },
  };

  function randomTargetIp() {
    const octet = () => Math.floor(Math.random() * 220) + 20;
    return `10.13.${octet()}.${octet()}`;
  }

  function tokenize(input) {
    const tokens = [];
    let current = "";
    let quote = null;

    for (let i = 0; i < input.length; i += 1) {
      const char = input[i];

      if (quote) {
        if (char === quote) quote = null;
        else current += char;
        continue;
      }

      if (char === '"' || char === "'") {
        quote = char;
        continue;
      }

      if (/\s/.test(char)) {
        if (current) {
          tokens.push(current);
          current = "";
        }
        continue;
      }

      current += char;
    }

    if (current) tokens.push(current);
    return tokens;
  }

  function createGame(options = {}) {
    const state = {
      targetIp: options.targetIp || randomTargetIp(),
      host: "attacker",
      user: "Icarus",
      cwd: "/",
      filesystem: null,
      flags: new Set(),
      history: [],
      discoveredDev: false,
      exposedShadow: false,
      crackedPassword: false,
      hasSshKey: false,
      completed: false,
    };

    const line = (text = "", type = "normal") => ({ text, type });

    function reset() {
      const fresh = createGame({ targetIp: state.targetIp });
      Object.assign(state, fresh.state);
      return intro();
    }

    function intro() {
      return [
        line("Então, mais um chegou.", "info"),
        line("Não se engane. Você não é um visitante. Você é uma infecção, e eu sou a cura.", "muted"),
        line(""),
        line("Isto não é um sistema real. É um labirinto simulado, construído para testar sua leitura do ambiente.", "muted"),
        line(`Seu alvo é ${state.targetIp}. Capture as quatro flags.`, "success"),
        line("Digite help se precisar lembrar os comandos disponíveis.", "info"),
      ];
    }

    function prompt() {
      if (state.host === "attacker") return `[${state.user}@leviathan]:~$`;
      const host = state.host === "internal" ? INTERNAL_IP : state.targetIp;
      const symbol = state.user === "root" ? "#" : "$";
      return `[${state.user}@${host}]:${state.cwd}${symbol}`;
    }

    function status() {
      return {
        targetIp: state.targetIp,
        flags: state.flags.size,
        totalFlags: 4,
        host: state.host,
        user: state.user,
        completed: state.completed,
      };
    }

    function resolvePath(path) {
      const base = path?.startsWith("/") ? [] : state.cwd.split("/").filter(Boolean);
      const parts = (path || ".").split("/").filter(Boolean);

      for (const part of parts) {
        if (part === ".") continue;
        if (part === "..") base.pop();
        else base.push(part);
      }

      return base;
    }

    function currentRoot() {
      return state.filesystem?.["/"] || null;
    }

    function getNode(parts) {
      let current = currentRoot();
      if (!current) return null;

      for (const part of parts) {
        if (!current || typeof current !== "object" || "content" in current || !(part in current)) return null;
        current = current[part];
      }

      return current;
    }

    function absolutePath(parts) {
      return `/${parts.join("/")}` || "/";
    }

    function isDirectory(node) {
      return !!node && typeof node === "object" && !("content" in node);
    }

    function canAccess(parts, node) {
      if (!node) return false;
      const path = absolutePath(parts);
      if (state.host === "target" && path.startsWith("/root") && state.user !== "root") return false;
      if (node.rootOnly && state.user !== "root") return false;
      return true;
    }

    function awardFlag(id) {
      if (state.flags.has(id)) return [];
      state.flags.add(id);
      if (id === 4) state.completed = true;

      const output = [line(`FLAG ${id}/4 CAPTURADA: ${FLAGS[id]}`, "success")];
      if (state.completed) {
        output.push(line(""));
        output.push(line("Impressionante. Você atravessou o labirinto e alcançou o núcleo do Leviathan.", "success"));
      }
      return output;
    }

    function help() {
      if (state.host === "attacker") {
        return [
          line("Sistema: help, hint, status, history, clear, reset"),
          line("Pentest: nmap, gobuster, curl, john, su"),
        ];
      }

      const common = "Sistema: help, hint, status, history, clear, reset, whoami, pwd, ls, cd, cat";
      if (state.host === "internal") return [line(common), line("Rede interna: nmap, rpc")];
      if (state.user === "root") return [line(common), line("Sistema: wireshark, ssh")];
      return [line(common), line("Sistema: find, /usr/local/bin/bkup_util")];
    }

    function hint() {
      if (!state.flags.has(1)) return [line("Há apenas um alvo e dois serviços expostos. Você sabe por onde começar.", "info")];
      if (!state.exposedShadow) return [line("O diretório escondido existe por um motivo. Se uma ferramenta interna aceita entrada, pense no que ler primeiro.", "info")];
      if (!state.crackedPassword) return [line("Você já tem o material bruto. Agora precisa transformá-lo em credencial.", "info")];
      if (state.host === "attacker") return [line("Uma conta comum ainda vale uma shell comum.", "info")];
      if (!state.flags.has(2)) return [line("Todo sistema mal configurado deixa rastros. Procure executáveis com privilégios demais.", "info")];
      if (!state.hasSshKey) return [line("Root pode ver o que os outros esconderam. O próximo salto costuma deixar tráfego para trás.", "info")];
      if (!state.flags.has(3)) return [line("A captura entregou o destino. Falta usá-la a seu favor.", "info")];
      if (!state.flags.has(4)) return [line("Há um serviço interno, uma documentação curta e um arquivo final. O resto é sintaxe.", "info")];
      return [line("Todas as flags já foram capturadas.", "success")];
    }

    function listDirectory(args) {
      if (state.host === "attacker") return [line("ls: não há filesystem local exposto neste console.", "error")];

      const showHidden = args.some((arg) => arg === "-a" || arg === "-la" || arg === "-al");
      const detailed = args.some((arg) => arg === "-l" || arg === "-la" || arg === "-al");
      const pathArg = args.find((arg) => !arg.startsWith("-"));
      const parts = resolvePath(pathArg);
      const node = getNode(parts);

      if (!isDirectory(node) || !canAccess(parts, node)) return [line(`ls: não foi possível acessar '${pathArg || state.cwd}'.`, "error")];

      const names = Object.keys(node).filter((name) => showHidden || !name.startsWith("."));
      if (!detailed) return [line(names.join("  "))];

      const rows = names.map((name) => {
        const child = node[name];
        const dir = isDirectory(child);
        const restricted = child.rootOnly || (absolutePath([...parts, name]).startsWith("/root") && state.user !== "root");
        const perms = dir ? "drwxr-xr-x" : restricted ? "-r--------" : child.special === "suid" ? "-rwsr-xr-x" : "-rw-r--r--";
        const owner = restricted || state.user === "root" ? "root" : state.user;
        return `${perms}  1 ${owner.padEnd(8)} ${owner.padEnd(8)} ${name}`;
      });

      return rows.map((row) => line(row));
    }

    function catFile(pathArg) {
      if (state.host === "attacker") return [line("cat: não há filesystem remoto montado neste console.", "error")];
      if (!pathArg) return [line("Uso: cat <arquivo>", "error")];

      const parts = resolvePath(pathArg);
      const node = getNode(parts);

      if (!node) return [line(`cat: ${pathArg}: arquivo não encontrado.`, "error")];
      if (isDirectory(node)) return [line(`cat: ${pathArg}: é um diretório.`, "error")];
      if (!canAccess(parts, node)) return [line(`cat: ${pathArg}: permissão negada.`, "error")];

      return String(node.content).split("\n").map((text) => line(text));
    }

    function changeDirectory(pathArg) {
      if (state.host === "attacker") return [line("cd: disponível depois de obter uma shell no alvo.", "error")];
      const parts = resolvePath(pathArg || "/home/leakuser");
      const node = getNode(parts);

      if (!isDirectory(node) || !canAccess(parts, node)) return [line(`cd: ${pathArg || ""}: diretório inexistente ou sem permissão.`, "error")];
      state.cwd = absolutePath(parts);
      return [];
    }

    function executeAttacker(command, args, rawArgs) {
      if (command === "nmap") {
        if (args[0] !== state.targetIp) return [line(`Uso: nmap ${state.targetIp}`, "error")];
        return [
          line(`Starting Nmap scan for ${state.targetIp}...`),
          line("PORT   STATE SERVICE"),
          line("22/tcp open  ssh"),
          line("80/tcp open  http"),
          
        ];
      }

      if (command === "gobuster") {
        const joined = args.join(" ");
        if (!joined.includes(`http://${state.targetIp}`)) return [line("gobuster: argumentos inválidos.", "error")];
        state.discoveredDev = true;
        return [
          line("===================================================="),
          line("Gobuster"),
          line("===================================================="),
          line("/dev   (Status: 200)"),
          line("===================================================="),
          ...awardFlag(1),
        ];
      }

      if (command === "curl") {
        if (!state.discoveredDev) return [line("curl: o caminho solicitado respondeu 404.", "error")];
        const url = rawArgs.trim();
        const base = `http://${state.targetIp}/dev/utils.php`;
        if (!url.startsWith(base)) return [line("curl: recurso não encontrado.", "error")];

        if (!url.includes("cmd=")) {
          return [
            line("<?php system($_GET['cmd'] ?? ''); ?>"),
            line("O parâmetro cmd parece chegar diretamente a system().", "info"),
          ];
        }

        let decoded = url;
        try {
          decoded = decodeURIComponent(url);
        } catch {
          return [line("curl: URL malformada.", "error")];
        }

        if (!/cmd=cat\s+\/etc\/shadow/i.test(decoded)) {
          return [line("A aplicação respondeu, mas nada útil apareceu.", "warning")];
        }

        state.exposedShadow = true;
        return [
          line(`root:$6$salt$longhashvaluehere`),
          line(`leakuser:${TARGET_HASH}:18632:0:99999:7:::`),
          
        ];
      }

      if (command === "john") {
        const joined = args.join(" ");
        if (!state.exposedShadow) return [line("john: nenhum hash útil foi obtido ainda.", "error")];
        if (!joined.includes(TARGET_HASH)) return [line("john: entrada inválida.", "error")];
        state.crackedPassword = true;
        return [
          line("Loaded 1 password hash"),
          line("max              (leakuser)", "success"),
          
        ];
      }

      if (command === "su") {
        if (args[0] !== "leakuser") return [line("Uso: su leakuser", "error")];
        if (!state.crackedPassword) return [line("su: falha na autenticação.", "error")];
        return { lines: [line("Senha para leakuser:", "info")], action: { type: "password", user: "leakuser" } };
      }

      return [line(`bash: ${command}: comando não encontrado.`, "error")];
    }

    function executeTarget(command, args) {
      if (command === "find") {
        if (state.user !== "leakuser") return [line("find: este caminho de enumeração já não é necessário.", "warning")];
        if (args.join(" ") !== "/ -perm -u=s -type f 2>/dev/null") return [line("Argumentos inválidos. Tente procurar arquivos SUID.", "error")];
        return [line("/usr/local/bin/bkup_util"), line("Interessante.", "warning")];
      }

      if (command === "/usr/local/bin/bkup_util") {
        if (state.user !== "leakuser") return [line("bkup_util: nada aconteceu.", "warning")];
        state.user = "root";
        state.cwd = "/root";
        return [
          line("Falha de validação de privilégios detectada..."),
          line("Shell elevada para root.", "success"),
          ...awardFlag(2),
        ];
      }

      if (command === "wireshark") {
        if (state.user !== "root") return [line("wireshark: permissão negada.", "error")];
        if (args[0] !== "/home/leakuser/capture.pcap") return [line("wireshark: arquivo inválido.", "error")];
        state.hasSshKey = true;
        return [
          line("Analisando capture.pcap..."),
          line("Fluxo SSH identificado."),
          line("Chave privada RSA recuperada da captura simulada."),
          line(`Destino observado: dev@${INTERNAL_IP}`),
        ];
      }

      if (command === "ssh") {
        if (args[0] !== `dev@${INTERNAL_IP}` || !state.hasSshKey) return [line("Permission denied (publickey).", "error")];
        state.host = "internal";
        state.user = "dev";
        state.cwd = "/home/dev";
        state.filesystem = internalFilesystem;
        return [
          line("Autenticando com a chave recuperada..."),
          line(`Conectado a ${INTERNAL_IP}.`, "success"),
          ...awardFlag(3),
        ];
      }

      return null;
    }

    function executeInternal(command, args, rawArgs) {
      if (command === "nmap") {
        if (!["localhost", "127.0.0.1", INTERNAL_IP].includes(args[0])) return [line("Uso: nmap localhost", "error")];
        return [
          line("PORT     STATE SERVICE"),
          line("1337/tcp open  customRPC"),
          line("Serviço incomum detectado."),
        ];
      }

      if (command === "rpc") {
        const normalized = rawArgs.replace(/\s+/g, " ").trim();
        const expected = "connect 127.0.0.1 1337; AUTH root; GET /srv/flag_final.txt";
        if (normalized !== expected) return [line("rpc: sequência rejeitada pelo protocolo.", "error")];
        return [
          line("Conectando ao customRPC..."),
          line("Falha de autenticação explorada."),
          line("Recuperando /srv/flag_final.txt..."),
          ...awardFlag(4),
        ];
      }

      return null;
    }

    function execute(input) {
      const trimmed = input.trim();
      if (!trimmed) return { lines: [] };

      state.history.push(trimmed);
      const tokens = tokenize(trimmed);
      const command = (tokens.shift() || "").toLowerCase();
      const args = tokens;
      const rawArgs = args.join(" ");

      if (command === "help") return { lines: help() };
      if (command === "hint") return { lines: hint() };
      if (command === "clear") return { lines: [], action: { type: "clear" } };
      if (command === "reset") return { lines: reset(), action: { type: "reset" } };
      if (command === "history") return { lines: state.history.map((entry, index) => line(`${String(index + 1).padStart(3, " ")}  ${entry}`)) };
      if (command === "status") {
        return {
          lines: [
            line(`Alvo: ${state.targetIp}`),
            line(`Host atual: ${state.host}`),
            line(`Usuário: ${state.user}`),
            line(`Flags: ${state.flags.size}/4`),
          ],
        };
      }

      if (state.host !== "attacker") {
        if (command === "whoami") return { lines: [line(state.user)] };
        if (command === "pwd") return { lines: [line(state.cwd)] };
        if (command === "ls") return { lines: listDirectory(args) };
        if (command === "cd") return { lines: changeDirectory(args[0]) };
        if (command === "cat") return { lines: catFile(args[0]) };
      }

      if (state.host === "attacker") {
        const result = executeAttacker(command, args, rawArgs);
        return Array.isArray(result) ? { lines: result } : result;
      }

      if (state.host === "target") {
        const special = executeTarget(command, args);
        if (special) return { lines: special };
      }

      if (state.host === "internal") {
        const special = executeInternal(command, args, rawArgs);
        if (special) return { lines: special };
      }

      return { lines: [line(`bash: ${command}: comando não encontrado.`, "error")] };
    }

    function submitPassword(password) {
      if (state.host !== "attacker" || !state.crackedPassword) return { lines: [line("Nenhuma autenticação pendente.", "error")] };
      if (password !== "max") return { lines: [line("su: falha na autenticação.", "error")] };

      state.host = "target";
      state.user = "leakuser";
      state.cwd = "/home/leakuser";
      state.filesystem = targetFilesystem;
      return {
        lines: [
          line("Login bem-sucedido.", "success"),
          line("Você agora possui uma shell limitada no alvo.", "info"),
        ],
      };
    }

    return { state, intro, prompt, status, execute, submitPassword };
  }

  function boot() {
    const terminal = document.getElementById("terminal");
    const form = document.getElementById("input-line");
    const input = document.getElementById("cmdline");
    const promptElement = document.getElementById("prompt");
    const targetStatus = document.getElementById("target-status");
    const flagStatus = document.getElementById("flag-status");
    const game = createGame();
    let historyIndex = 0;
    let waitingPassword = false;

    function append(text = "", type = "normal") {
      const row = document.createElement("div");
      row.className = `terminal-line text-${type}`;
      row.textContent = text;
      terminal.appendChild(row);
      terminal.scrollTop = terminal.scrollHeight;
    }

    function renderLines(lines = []) {
      for (const item of lines) append(item.text, item.type);
    }

    function renderStatus() {
      const info = game.status();
      targetStatus.textContent = `alvo: ${info.targetIp}`;
      flagStatus.textContent = `flags: ${info.flags}/${info.totalFlags}`;
      document.body.className = info.flags ? `flag-${info.flags}` : "";
      promptElement.textContent = waitingPassword ? "password:" : `${game.prompt()} `;
      input.type = waitingPassword ? "password" : "text";
      input.disabled = info.completed;
    }

    function echo(command) {
      append(`${game.prompt()} ${command}`, "command");
    }

    function applyResult(result) {
      if (result.action?.type === "clear") terminal.textContent = "";
      if (result.action?.type === "reset") terminal.textContent = "";
      if (result.action?.type === "password") waitingPassword = true;
      renderLines(result.lines);
      renderStatus();
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = input.value;
      input.value = "";

      if (waitingPassword) {
        append("password: ********", "command");
        waitingPassword = false;
        applyResult(game.submitPassword(value));
        historyIndex = game.state.history.length;
        input.focus();
        return;
      }

      const command = value.trim();
      if (!command) return;
      echo(command);
      applyResult(game.execute(command));
      historyIndex = game.state.history.length;
      input.focus();
    });

    input.addEventListener("keydown", (event) => {
      if (waitingPassword || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();

      if (event.key === "ArrowUp" && historyIndex > 0) historyIndex -= 1;
      if (event.key === "ArrowDown" && historyIndex < game.state.history.length) historyIndex += 1;

      input.value = game.state.history[historyIndex] || "";
      queueMicrotask(() => input.setSelectionRange(input.value.length, input.value.length));
    });

    document.addEventListener("click", (event) => {
      if (!window.getSelection()?.toString() && event.target !== input) input.focus();
    });

    renderLines(game.intro());
    renderStatus();
    historyIndex = game.state.history.length;
    input.focus();
  }

  if (typeof window !== "undefined") window.addEventListener("DOMContentLoaded", boot);
  if (typeof module !== "undefined" && module.exports) module.exports = { createGame, tokenize, FLAGS, TARGET_HASH, INTERNAL_IP };
})();
