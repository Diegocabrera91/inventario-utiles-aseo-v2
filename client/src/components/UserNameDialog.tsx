import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User } from "lucide-react";

interface UserNameDialogProps {
  onNameSet: (name: string) => void;
}

export default function UserNameDialog({ onNameSet }: UserNameDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    
    if (!trimmedName) {
      setError("Por favor ingresa tu nombre");
      return;
    }
    
    if (trimmedName.length > 50) {
      setError("El nombre es muy largo (máximo 50 caracteres)");
      return;
    }
    
    onNameSet(trimmedName);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-100 p-3 rounded-full">
              <User className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Inventario de Útiles de Aseo</CardTitle>
          <CardDescription>
            Ingresa tu nombre para acceder al sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Tu Nombre</Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="Ej: Juan, María, Carlos..."
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
                autoFocus
                autoComplete="name"
                className="text-base"
              />
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700"
              size="lg"
            >
              Acceder
            </Button>
            <p className="text-xs text-gray-500 text-center mt-4">
              Este nombre se guardará en tu navegador y se usará para registrar tus movimientos.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
