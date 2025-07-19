window.addEventListener('load', () => {
    const terminal = document.getElementById('terminal');
    const cmdline = document.getElementById('cmdline');
    const promptEl = document.getElementById('prompt');
    const logo = document.getElementById('logo');

    const filesystem = {
        '/': {
            'etc': {
                'passwd': { content: 'root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nbin:x:2:2:bin:/bin:/usr/sbin/nologin\nleakuser:x:1000:1000:Leak User,,,:/home/leakuser:/bin/bash' },
                'shadow': { content: 'root:$6$salt$longhashvaluehere\nbin:*:18632:0:99999:7:::\nleakuser:$1$max$yefFk99s23k4j4b2h2s3V.:18632:0:99999:7:::' },
                'hosts': { content: '127.0.0.1       localhost\n::1             localhost ip6-localhost ip6-loopback' },
                'ssh': {
                    'sshd_config': { content: 'PermitRootLogin no\nPasswordAuthentication no\nPubkeyAuthentication yes' }
                }
            },
            'home': {
                'leakuser': {
                    '.bash_history': { content: 'sudo apt update\n/usr/local/bin/bkup_util\nssh dev@172.16.20.20\n# A senha do leakuser é "max", o nome do meu cachorro.' },
                    'documents': {
                        'notes.txt': { content: 'Lembretes:\n- Terminar relatório do projeto Leviathan.\n- Comprar mais ração para o Max.\n- Trocar a senha do roteador, admin/admin não é seguro.' },
                        'work_stuff': {}
                    },
                    'capture.pcap': { content: '[Arquivo de captura de pacotes, parece pesado...]', special: 'pcap' }
                }
            },
            'var': {
                'www': {
                    'html': {
                        'index.html': { content: '<h1>Servidor Web Padrão</h1><p>Em construção.</p>' },
                        'dev': {
                            'index.html': { content: 'Área de Desenvolvimento - Acesso Restrito' },
                            'utils.php': { content: '<?php // Ferramentas internas. Cuidado. ?>', special: 'vuln_script' }
                        }
                    }
                },
                'log': {
                    'syslog': { content: `Jul 19 10:00:01 server CRON[1234]: (root) CMD (   ...   )\nJul 19 10:01:01 server CRON[1235]: (root) CMD (   ...   )` },
                    'auth.log': { content: `Jul 19 10:02:00 server sshd[1236]: Failed password for invalid user guest from 192.168.1.10 port 22` }
                }
            },
            'root': {
                'flag2.txt': { content: 'flag{realistic_privesc_pathway}', perms: 'r--------' },
                'setup.sh': { content: 'chmod u+s /usr/local/bin/bkup_util', perms: 'rwx------' }
            },
            'usr': {
                'local': {
                    'bin': {
                        'bkup_util': { content: '[binário executável]', special: 'suid_binary' }
                    }
                }
            },
        }
    };

    const internal_filesystem = {
        '/': {
            'home': {
                'dev': {
                    'flag3.txt': { content: 'flag{internal_pivoting_achieved}' },
                    'rpc_client': { content: '[binário cliente]', special: 'rpc_client_binary' },
                    'README.md': { content: 'Este cliente se conecta ao serviço Leviathan Protocol (customRPC) na porta 1337.' }
                }
            },
            'srv': {
                'flag_final.txt': { content: 'flag{leviathan_protocol_terminated}', perms: 'r--------' }
            }
        }
    };

    const state = {
        user: 'Icarus',
        displayIp: randomIp(),
        targetIp: '10.10.10.11',
        ip: '10.10.10.11',
        cwd: '/',
        flags: new Set(),
        hasSshKey: false,
        history: [],
        historyIndex: 0,
        currentFilesystem: filesystem,
    };

    function randomIp() {
        return Array(4).fill(0).map(() => Math.floor(Math.random() * 255)).join('.');
    }

    function print(text, isHtml = false) {
        const div = document.createElement('div');
        div.innerHTML = isHtml ? text.replace(/\n/g, '<br>') : text.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;');
        terminal.appendChild(div);
        terminal.scrollTop = terminal.scrollHeight;
    }

    function printError(text) { print(`<span class="error-message">${text}</span>`, true); }
    function printInfo(text) { print(`<span class="info-message">${text}</span>`, true); }
    function printSuccess(text) { print(`<span class="success-message">${text}</span>`, true); }

    function updatePrompt() {
        const ipForPrompt = (state.ip === state.targetIp) ? state.displayIp : state.ip;
        const userForPrompt = (state.user === 'root' || (state.ip === '172.16.20.20' && state.user === 'dev')) ? `<span class="prompt-root">${state.user}</span>` : state.user;
        const promptSymbol = (state.user === 'root') ? '#' : '$';
        promptEl.innerHTML = `[${userForPrompt}@${ipForPrompt}]:${state.cwd}${promptSymbol} `;
    }

    function resolvePath(path) {
        if (!path) return state.cwd.split('/').filter(p => p);
        if (path.startsWith('/')) return path.split('/').filter(p => p);
        const current = state.cwd.split('/').filter(p => p);
        const newParts = path.split('/').filter(p => p);
        for (const part of newParts) {
            if (part === '..') { if (current.length > 0) current.pop(); } 
            else if (part !== '.') { current.push(part); }
        }
        return current;
    }

    function getFromFilesystem(pathParts) {
        let current = state.currentFilesystem['/'];
        for (const part of pathParts) {
            if (current && typeof current === 'object' && !current.content && part in current) {
                current = current[part];
            } else { return null; }
        }
        return current;
    }

    function awardFlag(id, flag, nextHint) {
        if (state.flags.has(id)) return;
        state.flags.add(id);
        logo.className = '';
        logo.classList.add(`flag${id}`);
        const flagMessage = `<span class="success-message"><br>[+] FLAG ${id} CAPTURADA:</span> ${flag}`;
        const hintMessage = nextHint ? `<span class="info-message">DICA: ${nextHint}</span><br>` : '';
        const congratsMessage = state.flags.size === 4 ? `<span class="success-message"><br>Impressionante.<br>Você navegou pelo meu labirinto e tocou no meu núcleo. Nenhum outro chegou tão longe.<br>Por um instante, você viu a mente de um deus. Agora vá.</span>` : '';
        setTimeout(() => {
            terminal.textContent = '';
            print(flagMessage, true);
            if (hintMessage) print(hintMessage, true);
            if (congratsMessage) print(congratsMessage, true);
            if (state.flags.size < 4) { updatePrompt(); } 
            else { cmdline.disabled = true; promptEl.textContent = ''; }
        }, 300);
    }

    function handleCommand(command, args) {
        if (command === 'cd') {
            const targetPathParts = resolvePath(args[0]);
            const newPath = '/' + targetPathParts.join('/');
            const targetDir = getFromFilesystem(targetPathParts);
            if (targetDir && typeof targetDir === 'object' && !targetDir.content) {
                state.cwd = newPath + (newPath === '/' ? '' : '/');
            } else { printError(`cd: ${args[0]}: Não é um diretório ou não existe.`); }
            return;
        }

        if (command === 'ls') {
            const pathArg = args.find(a => !a.startsWith('-'));
            const targetDir = getFromFilesystem(resolvePath(pathArg));
            if (targetDir && typeof targetDir === 'object' && !targetDir.content) {
                let output = '';
                const showDetails = args.includes('-la');
                if (showDetails) output += `total ${Object.keys(targetDir).length}\n`;
                for (const item in targetDir) {
                    const isDir = typeof targetDir[item] === 'object' && !targetDir[item].content;
                    if (showDetails) {
                        const perms = isDir ? 'drwxr-xr-x' : (targetDir[item].perms || 'rw-r--r--');
                        const owner = (targetDir[item].owner || (state.user === 'root' || state.user === 'dev') ? 'root' : 'leakuser');
                        const group = owner;
                        output += `${perms}  1 ${owner} ${group} 4096 Jul 19 10:00 ${item}\n`;
                    } else {
                        output += `${item.endsWith('.txt') ? `<span class="info-message">${item}</span>` : item}\t`;
                    }
                }
                print(output, true);
            } else { printError(`ls: não pode acessar '${pathArg || state.cwd}': Arquivo ou diretório não encontrado.`); }
            return;
        }

        if (command === 'cat') {
            if (!args[0]) { printError('Uso: cat <arquivo>'); return; }
            const pathParts = resolvePath(args[0]);
            const file = getFromFilesystem(pathParts);
            if (file && file.content) {
                if (file === filesystem['/'].root['flag2.txt'] && state.user !== 'root') {
                    printError(`cat: ${args[0]}: Permissão negada.`);
                    return;
                }
                print(file.content);
                if (file === filesystem['/'].etc['shadow']) {
                    printInfo(`\nVocê conseguiu ler o arquivo shadow. Isso é uma falha grave.\nSeu objetivo agora é quebrar esse hash para obter uma senha. Que ferramenta é famosa por isso?`);
                }
            } else if (file) { printError(`cat: ${args[0]}: É um diretório.`); } 
            else { printError(`cat: ${args[0]}: Arquivo ou diretório não encontrado.`); }
            return;
        }

        if (command === 'clear') { terminal.textContent = ''; return; }

        if (command === 'help') {
            let available = 'Comandos de sistema: help, clear, ls, cat, cd';
            if (state.ip === '172.16.20.20') { print(`${available}\nComandos de rede: nmap, rpc`); }
            else if (state.user === 'root') { print(`${available}\nComandos de root: wireshark, ssh`); }
            else if (state.user === 'leakuser') { print(`${available}\nComandos de usuário: find, /usr/local/bin/bkup_util`); }
            else { print(`${available}\nComandos de pentest: nmap, gobuster, curl, su, john`); }
            return;
        }

        // (...continua com os comandos personalizados do CTF)

        // Código continua...
    }

    cmdline.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            if (e.key === 'ArrowUp' && state.historyIndex > 0) {
                state.historyIndex--;
                cmdline.value = state.history[state.historyIndex] || '';
            } else if (e.key === 'ArrowDown') {
                if (state.historyIndex < state.history.length - 1) {
                    state.historyIndex++;
                    cmdline.value = state.history[state.historyIndex] || '';
                } else {
                    state.historyIndex = state.history.length;
                    cmdline.value = '';
                }
            }
            return;
        }

        if (e.key !== 'Enter') return;
        const input = cmdline.value.trim();
        const promptText = promptEl.innerHTML;
        print(promptText + input, true);
        if (input) {
            state.history.push(input);
            handleCommand(input.split(' ')[0], input.split(' ').slice(1));
        }
        state.historyIndex = state.history.length;
        let shouldClearAfterFlag = ['gobuster', '/usr/local/bin/bkup_util', 'ssh', 'rpc'];
        if (shouldClearAfterFlag.includes(input.split(' ')[0]) && state.flags.size < 5) {
            cmdline.value = '';
        } else {
            cmdline.value = '';
            updatePrompt();
        }
    });

    print(`<span class="info-message"><br>Então, mais um chegou.</span>`, true);
    print(`<span class="info-message">Não se engane. Você não é um visitante. Você é uma infecção, e eu sou a cura.</span>`, true);
    print(`<span class="intro-text"><br>Isto não é um sistema a ser hackeado. É a minha mente, exposta como uma armadilha.</span>`, true);
    print(`<span class="intro-text">As flags não são seus troféus. São minhas memórias. E eu não as compartilho de bom grado.</span>`, true);
    print(`<br>Inicie sua tentativa fútil em: <span class="success-message">${state.displayIp}</span>`, true);
    print(`<span class="info-message">Digite \`help\` para uma lista de comandos disponíveis.</span>`, true);
    print(`<span class="intro-text">--------------------------------------------------------------------------</span><br>`, true);

    updatePrompt();
    cmdline.focus();
});
