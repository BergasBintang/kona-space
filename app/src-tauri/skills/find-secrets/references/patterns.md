# Patterns worth searching for

Look at each hit with your own eyes; many are false alarms. Do not paste a whole match into a reply.

**By name**
```
(api[_-]?key|secret|token|passw(or)?d|pwd|auth|credential|private[_-]?key)\s*[:=]
```

**By shape**
| What | How it starts or looks |
|---|---|
| Private key | `-----BEGIN` followed by `PRIVATE KEY` |
| AWS access key | `AKIA` and 16 capitals or digits |
| GitHub token | `ghp_`, `gho_`, `ghs_`, `github_pat_` |
| Stripe key | `sk_live_`, `rk_live_` |
| Slack token | `xoxb-`, `xoxp-` |
| Google API key | `AIza` and 35 characters |
| Anthropic key | `sk-ant-` |
| OpenAI key | `sk-` and a long string |
| JWT | `eyJ` with two dots in it |
| Database address with a password | `://user:password@host` |

**Files worth opening**
`.env*`, `*.pem`, `*.key`, `*.p12`, `id_rsa`, `credentials*`, `secrets*`, `settings*.json`, `config*`, `docker-compose*`, `*.tfvars`, CI files, shell scripts, sample data, database dumps, notebooks with saved output, and logs.

**Likely false alarms**
Placeholder words such as `your-key-here` or `xxx`, test values, hashes of files in lock files, and the names of settings without a value.
