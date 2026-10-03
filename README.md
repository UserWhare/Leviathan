<div align="center">

<img src="https://i.imgur.com/WhCWd2W.png" alt="Leviathan" width="180">

# Leviathan CTF

**Um desafio Capture The Flag executado inteiramente no navegador através de um terminal interativo.**

![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-2ea44f?style=for-the-badge)

**[Jogar no navegador](https://userwhare.github.io/Leviathan/)**

</div>

---

Leviathan simula um pequeno ambiente Linux com enumeração, exploração web, quebra de hash, escalação de privilégios, pivoting e um serviço interno vulnerável.

Todo o desafio é local e simulado. Nenhuma varredura, conexão SSH ou exploração real é executada.

## Objetivo

Capture as quatro flags seguindo a cadeia de exploração do ambiente.

- Enumeração do alvo e aplicação web
- Leitura de arquivos através de uma falha simulada
- Quebra de credenciais e acesso ao usuário
- Escalação de privilégios por SUID
- Análise de captura e pivoting para a rede interna
- Exploração final de um serviço RPC

## Dificuldade

Esta versão evita entregar a solução de forma direta. Os comandos auxiliares existem, mas o desafio foi pensado para exigir mais leitura do ambiente e menos hand-holding.

## Comandos

O terminal implementa apenas os comandos necessários para o desafio, incluindo:

`nmap` · `gobuster` · `curl` · `john` · `su` · `find` · `wireshark` · `ssh` · `rpc`

Também estão disponíveis comandos auxiliares como `help`, `hint`, `status`, `history`, `whoami`, `pwd`, `ls`, `cat`, `cd`, `clear` e `reset`.

## Rodando localmente

```bash
git clone https://github.com/UserWhare/Leviathan.git
cd Leviathan
```

Abra o `index.html` diretamente ou utilize um servidor HTTP local:

```bash
python -m http.server 8080
```

Depois acesse `http://localhost:8080`.

## Licença

Distribuído sob a [Licença MIT](LICENSE).

---

<div align="center">

Feito por [UserWhare](https://github.com/UserWhare)

</div>
