from typing import List, Optional
from datetime import datetime
from sqlalchemy import String, Integer, Float, Boolean, ForeignKey, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class Compte(Base):
    __tablename__ = "compte"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nom: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    adresse: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), unique=True, nullable=True)
    telephone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    entrepots: Mapped[List["Entrepot"]] = relationship(back_populates="compte", cascade="all, delete-orphan")
    familles: Mapped[List["FamilleArticle"]] = relationship(back_populates="compte", cascade="all, delete-orphan")

class Entrepot(Base):
    __tablename__ = "entrepot"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    compte_id: Mapped[int] = mapped_column(ForeignKey("compte.id"))
    nom: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    adresse: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    capacite_max: Mapped[Optional[float]] = mapped_column(Float, default=0.0)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    compte: Mapped["Compte"] = relationship(back_populates="entrepots")
    zones: Mapped[List["Zone"]] = relationship(back_populates="entrepot", cascade="all, delete-orphan")

class TypeZone(Base):
    __tablename__ = "type_zone"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nom: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    couleur: Mapped[Optional[str]] = mapped_column(String(7), nullable=True)
    restrictions_stockage: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    zones: Mapped[List["Zone"]] = relationship(back_populates="type_zone")

class Zone(Base):
    __tablename__ = "zone"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    entrepot_id: Mapped[int] = mapped_column(ForeignKey("entrepot.id"))
    type_zone_id: Mapped[int] = mapped_column(ForeignKey("type_zone.id"))
    nom: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    entrepot: Mapped["Entrepot"] = relationship(back_populates="zones")
    type_zone: Mapped["TypeZone"] = relationship(back_populates="zones")
    emplacements: Mapped[List["Emplacement"]] = relationship(back_populates="zone", cascade="all, delete-orphan")

class TypeEmplacement(Base):
    __tablename__ = "type_emplacement"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nom: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    dimensions_max_longueur: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    dimensions_max_largeur: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    dimensions_max_hauteur: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    poids_max_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    emplacements: Mapped[List["Emplacement"]] = relationship(back_populates="type_emplacement")

class Emplacement(Base):
    __tablename__ = "emplacement"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    zone_id: Mapped[int] = mapped_column(ForeignKey("zone.id")) # CDC implied hierarchy
    type_emplacement_id: Mapped[int] = mapped_column(ForeignKey("type_emplacement.id"))
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False) # Format: Aisle-Bay-Level
    niveau: Mapped[int] = mapped_column(Integer, default=0)
    dimension_longueur_cm: Mapped[float] = mapped_column(Float, default=0.0)
    dimension_largeur_cm: Mapped[float] = mapped_column(Float, default=0.0)
    dimension_hauteur_cm: Mapped[float] = mapped_column(Float, default=0.0)
    poids_max_kg: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[bool] = mapped_column(Boolean, default=False) # Occupied / Free

    zone: Mapped["Zone"] = relationship(back_populates="emplacements")
    type_emplacement: Mapped["TypeEmplacement"] = relationship(back_populates="emplacements")
    stocks: Mapped[List["Stock"]] = relationship(back_populates="emplacement")

class Marque(Base):
    __tablename__ = "marque"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nom: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    articles: Mapped[List["Article"]] = relationship(back_populates="marque")

class FamilleArticle(Base):
    __tablename__ = "famille_article"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    compte_id: Mapped[int] = mapped_column(ForeignKey("compte.id"))
    nom: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("famille_article.id"), nullable=True)

    compte: Mapped["Compte"] = relationship(back_populates="familles")
    parent: Mapped[Optional["FamilleArticle"]] = relationship(remote_side=[id])
    articles: Mapped[List["Article"]] = relationship(back_populates="famille")

class Article(Base):
    __tablename__ = "article"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    famille_id: Mapped[int] = mapped_column(ForeignKey("famille_article.id"))
    marque_id: Mapped[Optional[int]] = mapped_column(ForeignKey("marque.id"), nullable=True)
    code_article: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    code_barre: Mapped[Optional[str]] = mapped_column(String(50), unique=True, nullable=True)
    reference_fournisseur: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    nom: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    dimension_longueur_cm: Mapped[float] = mapped_column(Float, default=0.0)
    dimension_largeur_cm: Mapped[float] = mapped_column(Float, default=0.0)
    dimension_hauteur_cm: Mapped[float] = mapped_column(Float, default=0.0)
    poids_kg: Mapped[float] = mapped_column(Float, default=0.0)
    volume_m3: Mapped[float] = mapped_column(Float, default=0.0)
    unite_mesure: Mapped[str] = mapped_column(String(20), default="pcs")
    
    # Packaging options
    quantite_par_carton: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    dimension_carton_longueur: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    dimension_carton_largeur: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    dimension_carton_hauteur: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    poids_carton: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    cartons_par_palette: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    hauteur_palette: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    type_palette: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    emballage_special: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    famille: Mapped["FamilleArticle"] = relationship(back_populates="articles")
    marque: Mapped[Optional["Marque"]] = relationship(back_populates="articles")
    stocks: Mapped[List["Stock"]] = relationship(back_populates="article")

class Stock(Base):
    __tablename__ = "stock"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    emplacement_id: Mapped[int] = mapped_column(ForeignKey("emplacement.id"))
    article_id: Mapped[int] = mapped_column(ForeignKey("article.id"))
    quantite: Mapped[int] = mapped_column(Integer, default=0)
    date_maj: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    emplacement: Mapped["Emplacement"] = relationship(back_populates="stocks")
    article: Mapped["Article"] = relationship(back_populates="stocks")
