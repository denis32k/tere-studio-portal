import React, { useState } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Screen, Logo, PrimaryButton, LinkButton, TextField, ErrorNote, InfoNote, maskCpf } from '../components/ui';
import { ApiError, portalLoginRequest, portalLoginCodeConfirm, portalSetPassword, portalLogin, type ClienteResumo } from '../lib/api';

type Etapa = 'entrar' | 'primeiro_acesso' | 'codigo' | 'criar_senha';

export default function LoginPage({ onLogin }: { onLogin: (token: string, cliente: ClienteResumo) => void }) {
  const [etapa, setEtapa] = useState<Etapa>('entrar');
  const [email, setEmail] = useState('');
  const [documento, setDocumento] = useState('');
  const [senha, setSenha] = useState('');
  const [senhaConfirma, setSenhaConfirma] = useState('');
  const [codigo, setCodigo] = useState('');
  const [pendingToken, setPendingToken] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  const digitosDocumento = documento.replace(/\D+/g, '');

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(''); setCarregando(true);
    try {
      const resp = await portalLogin(email.trim().toLowerCase(), senha);
      onLogin(resp.token, resp.cliente);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não consegui entrar agora.');
    } finally {
      setCarregando(false);
    }
  };

  const pedirAcesso = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(''); setAviso(''); setCarregando(true);
    try {
      const resp = await portalLoginRequest(email.trim().toLowerCase(), digitosDocumento);
      if (resp.precisaCodigo === false) {
        setAviso('Este e-mail já tem senha cadastrada. Entre normalmente.');
        setEtapa('entrar');
        return;
      }
      setAviso('Enviamos um código de 6 dígitos para o seu e-mail. Ele vale por alguns minutos.');
      setEtapa('codigo');
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não consegui pedir o acesso agora.');
    } finally {
      setCarregando(false);
    }
  };

  const confirmarCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(''); setCarregando(true);
    try {
      const resp = await portalLoginCodeConfirm(email.trim().toLowerCase(), digitosDocumento, codigo.trim());
      setPendingToken(resp.pendingToken);
      setAviso('');
      setEtapa('criar_senha');
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Código incorreto ou expirado.');
    } finally {
      setCarregando(false);
    }
  };

  const criarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    if (senha.length < 8) { setErro('A senha precisa ter pelo menos 8 caracteres.'); return; }
    if (senha !== senhaConfirma) { setErro('As senhas não são iguais.'); return; }
    setCarregando(true);
    try {
      const resp = await portalSetPassword(pendingToken, senha);
      onLogin(resp.token, resp.cliente);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não consegui salvar sua senha agora.');
    } finally {
      setCarregando(false);
    }
  };

  const voltarParaInicio = (proxima: Etapa) => {
    setErro(''); setAviso(''); setSenha(''); setSenhaConfirma(''); setCodigo('');
    setEtapa(proxima);
  };

  return (
    <Screen>
      <div className="flex-1 flex flex-col justify-center px-6 py-10 max-w-md mx-auto w-full gap-6">
        <div className="flex justify-center mb-2"><Logo /></div>

        {etapa === 'entrar' && (
          <form onSubmit={entrar} className="space-y-4">
            <div className="text-center space-y-1 mb-2">
              <h1 className="font-display italic text-2xl text-foreground">Entrar</h1>
              <p className="text-sm text-muted-foreground">Gere prévias dos seus produtos de qualquer lugar.</p>
            </div>
            <InfoNote>{aviso}</InfoNote>
            <TextField label="E-mail" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@exemplo.com" />
            <TextField label="Senha" type="password" autoComplete="current-password" required value={senha} onChange={e => setSenha(e.target.value)} placeholder="Sua senha" />
            <ErrorNote>{erro}</ErrorNote>
            <PrimaryButton type="submit" loading={carregando}>Entrar</PrimaryButton>
            <div className="text-center pt-1">
              <LinkButton type="button" onClick={() => voltarParaInicio('primeiro_acesso')}>É o seu primeiro acesso?</LinkButton>
            </div>
          </form>
        )}

        {etapa === 'primeiro_acesso' && (
          <form onSubmit={pedirAcesso} className="space-y-4">
            <button type="button" onClick={() => voltarParaInicio('entrar')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1"><ArrowLeft size={14} />Voltar</button>
            <div className="text-center space-y-1 mb-2">
              <h1 className="font-display italic text-2xl text-foreground">Primeiro acesso</h1>
              <p className="text-sm text-muted-foreground">Confirme os dados já cadastrados na sua licença Terê Studio.</p>
            </div>
            <TextField label="E-mail" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@exemplo.com" />
            <TextField label="CPF" inputMode="numeric" autoComplete="off" required value={documento} onChange={e => setDocumento(maskCpf(e.target.value))} placeholder="000.000.000-00" maxLength={14} />
            <ErrorNote>{erro}</ErrorNote>
            <PrimaryButton type="submit" loading={carregando}><ShieldCheck size={16} />Receber código por e-mail</PrimaryButton>
          </form>
        )}

        {etapa === 'codigo' && (
          <form onSubmit={confirmarCodigo} className="space-y-4">
            <button type="button" onClick={() => voltarParaInicio('primeiro_acesso')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1"><ArrowLeft size={14} />Voltar</button>
            <div className="text-center space-y-1 mb-2">
              <h1 className="font-display italic text-2xl text-foreground">Digite o código</h1>
              <p className="text-sm text-muted-foreground">Enviamos um código de 6 dígitos para {email}.</p>
            </div>
            <TextField label="Código" inputMode="numeric" autoComplete="one-time-code" required value={codigo} onChange={e => setCodigo(e.target.value.replace(/\D+/g, '').slice(0, 6))} placeholder="000000" maxLength={6} className="text-center tracking-[0.5em] text-lg font-semibold" />
            <ErrorNote>{erro}</ErrorNote>
            <PrimaryButton type="submit" loading={carregando}>Confirmar código</PrimaryButton>
          </form>
        )}

        {etapa === 'criar_senha' && (
          <form onSubmit={criarSenha} className="space-y-4">
            <div className="text-center space-y-1 mb-2">
              <h1 className="font-display italic text-2xl text-foreground">Crie sua senha</h1>
              <p className="text-sm text-muted-foreground">É a senha que você vai usar para entrar da próxima vez.</p>
            </div>
            <TextField label="Nova senha" type="password" autoComplete="new-password" required value={senha} onChange={e => setSenha(e.target.value)} placeholder="Mínimo 8 caracteres" />
            <TextField label="Confirme a senha" type="password" autoComplete="new-password" required value={senhaConfirma} onChange={e => setSenhaConfirma(e.target.value)} placeholder="Repita a senha" />
            <ErrorNote>{erro}</ErrorNote>
            <PrimaryButton type="submit" loading={carregando}>Salvar senha e entrar</PrimaryButton>
          </form>
        )}
      </div>
    </Screen>
  );
}
