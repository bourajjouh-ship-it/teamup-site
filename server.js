// server.js
// Serveur qui gère les profils ET maintenant les comptes (inscription/connexion)

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const app = express();
const PORT = 3000;
const FICHIER_PROFILS = "profils.json";
const FICHIER_USERS = "users.json";
const FICHIER_DEMANDES = "demandes.json";

app.use(cors());
app.use(express.json());

// Création des fichiers de stockage s'ils n'existent pas
if (!fs.existsSync(FICHIER_PROFILS)) fs.writeFileSync(FICHIER_PROFILS, "[]");
if (!fs.existsSync(FICHIER_USERS)) fs.writeFileSync(FICHIER_USERS, "[]");
if (!fs.existsSync(FICHIER_DEMANDES)) fs.writeFileSync(FICHIER_DEMANDES, "[]");

// ---------- COMPTES ----------

// Inscription
app.post("/api/inscription", async (req, res) => {
  const { pseudo, motDePasse } = req.body;

  if (!pseudo || !motDePasse) {
    return res.status(400).json({ erreur: "Pseudo et mot de passe requis." });
  }

  const users = JSON.parse(fs.readFileSync(FICHIER_USERS));

  const dejaExistant = users.find(u => u.pseudo.toLowerCase() === pseudo.toLowerCase());
  if (dejaExistant) {
    return res.status(400).json({ erreur: "Ce pseudo est déjà pris." });
  }

  // On chiffre le mot de passe avant de le sauvegarder
  const motDePasseChiffre = await bcrypt.hash(motDePasse, 10);

  users.push({ pseudo, motDePasse: motDePasseChiffre });
  fs.writeFileSync(FICHIER_USERS, JSON.stringify(users, null, 2));

  res.json({ message: "Compte créé !", pseudo });
});

// Connexion
app.post("/api/connexion", async (req, res) => {
  const { pseudo, motDePasse } = req.body;

  const users = JSON.parse(fs.readFileSync(FICHIER_USERS));
  const utilisateur = users.find(u => u.pseudo.toLowerCase() === pseudo.toLowerCase());

  if (!utilisateur) {
    return res.status(400).json({ erreur: "Pseudo ou mot de passe incorrect." });
  }

  const motDePasseValide = await bcrypt.compare(motDePasse, utilisateur.motDePasse);
  if (!motDePasseValide) {
    return res.status(400).json({ erreur: "Pseudo ou mot de passe incorrect." });
  }

  res.json({ message: "Connexion réussie !", pseudo: utilisateur.pseudo });
});

// ---------- PROFILS ----------

app.post("/api/profils", (req, res) => {
  const nouveauProfil = req.body;
  const profils = JSON.parse(fs.readFileSync(FICHIER_PROFILS));
  profils.push(nouveauProfil);
  fs.writeFileSync(FICHIER_PROFILS, JSON.stringify(profils, null, 2));
  res.json({ message: "Profil enregistré !", profil: nouveauProfil });
});

app.get("/api/profils", (req, res) => {
  const profils = JSON.parse(fs.readFileSync(FICHIER_PROFILS));
  res.json(profils);
});

// ---------- DEMANDES DE PARTIE ----------

// Envoyer une demande ("Proposer une partie")
app.post("/api/demandes", (req, res) => {
  const { de, pour, jeu } = req.body;

  if (!de || !pour) {
    return res.status(400).json({ erreur: "Infos manquantes." });
  }

  const demandes = JSON.parse(fs.readFileSync(FICHIER_DEMANDES));
  demandes.push({ de, pour, jeu, date: new Date().toISOString() });
  fs.writeFileSync(FICHIER_DEMANDES, JSON.stringify(demandes, null, 2));

  res.json({ message: "Demande envoyée !" });
});

// Récupérer les demandes reçues par un pseudo
app.get("/api/demandes/:pseudo", (req, res) => {
  const demandes = JSON.parse(fs.readFileSync(FICHIER_DEMANDES));
  const mesDemandes = demandes.filter(d => d.pour.toLowerCase() === req.params.pseudo.toLowerCase());
  res.json(mesDemandes);
});

// ---------- VIP / PAIEMENT ----------

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

app.post("/api/creer-paiement-vip", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: "Abonnement VIP TeamUp" },
            unit_amount: 499, // 4,99€ en centimes
            recurring: { interval: "month" }
          },
          quantity: 1
        }
      ],
      success_url: "https://teamup-site-2026.netlify.app/vip-succes.html",
      cancel_url: "https://teamup-site-2026.netlify.app/vip.html"
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: "Erreur lors de la création du paiement." });
  }
});

app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});