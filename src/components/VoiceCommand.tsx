import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { listenOnce, speak, speechSupported, matchOperationFromVoice } from "@/lib/voice";
import { toast } from "sonner";
import { OPERATIONS } from "@/lib/operations";

export function VoiceCommand({ onLaunch }: { onLaunch: (operationId: string) => void }) {
  const [listening, setListening] = useState(false);
  const supported = speechSupported();

  const handle = () => {
    if (!supported) {
      toast.error("Reconnaissance vocale non supportée par ce navigateur");
      return;
    }
    setListening(true);
    speak("J'écoute, dites une opération.");
    const ctl = listenOnce({
      onResult: (t) => {
        const id = matchOperationFromVoice(t);
        if (id) {
          const op = OPERATIONS.find((o) => o.id === id);
          toast.success(`« ${t} » → ${op?.name}`);
          speak(`Lancement de ${op?.name}.`);
          onLaunch(id);
        } else {
          toast.warning(`Non reconnu : « ${t} »`);
          speak("Je n'ai pas compris l'opération.");
        }
      },
      onError: (e) => {
        if (e !== "no-speech") toast.error(`Voix : ${e}`);
      },
      onEnd: () => setListening(false),
    });
    ctl?.start();
  };

  return (
    <Button
      type="button"
      onClick={handle}
      disabled={listening}
      variant={listening ? "default" : "outline"}
      className={listening ? "bg-red-600 hover:bg-red-600 text-white animate-pulse" : ""}
    >
      {listening ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : supported ? <Mic className="w-4 h-4 mr-1.5" /> : <MicOff className="w-4 h-4 mr-1.5" />}
      {listening ? "Écoute…" : "Commande vocale"}
    </Button>
  );
}
