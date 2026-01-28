# Quoridor Online

Jeu de Quoridor multijoueur en temps reel, construit pour demontrer l'utilisation de [ZeroStack](https://zerostack.myapp.fr) comme backend dans un jeu en ligne.

Jouez en ligne : **[quoridor.myapp.fr](https://quoridor.myapp.fr)**

## Objectif

Ce projet sert de demo technique pour montrer comment ZeroStack peut etre utilise comme Backend-as-a-Service pour un jeu multijoueur :

- **Authentification** : inscription, connexion et mode invite via `zs.auth`
- **Donnees en temps reel** : synchronisation de l'etat de jeu entre joueurs via `zs.realtime`
- **CRUD** : creation/mise a jour/suppression de parties via `zs.data`
- **TTL** : expiration automatique des parties inactives via `zs.config.setNodeTTL`
- **Permissions** : controle d'acces par partie avec le systeme `allowed` de ZeroStack

## Stack technique

- **Frontend** : TypeScript, Vite
- **Rendu 3D** : Three.js
- **Backend** : ZeroStack (BaaS) via `zerostack-sdk`
- **Temps reel** : Socket.IO (via le SDK ZeroStack)

## Lancer en local

```bash
npm install
npm run dev
```

Configurer les variables d'environnement dans `.env.development` :

```
VITE_API_URL=http://localhost:3002/api
VITE_WS_URL=http://localhost:3002
VITE_API_KEY=zs_...
```

## Deploiement

```bash
./deploy.sh
```

## Licence

(c) 2025 Tomsoft. Tous droits reserves.
