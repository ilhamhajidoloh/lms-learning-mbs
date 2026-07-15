import { Code } from "lucide-react";
import { tx, card } from "../../../lib/theme";

export default function CodeTab() {
  return (
    <div className="rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl animate-fadeIn text-left" style={card.style}>
      <div className="flex justify-between items-center border-b pb-2" style={{ borderColor: tx.borderS }}>
        <span className="font-bold flex items-center gap-2 text-lg">
          <Code className="h-5 w-5 text-indigo-500" /> ชุดโค้ดสาธิตการเชื่อมโยงระบบ (TypeScript SDK)
        </span>
      </div>
      <pre className="bg-slate-950 text-indigo-400 p-5 rounded-2xl text-xs overflow-x-auto text-left font-mono">
{`import { Client } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential } from "@azure/identity";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProvider";

// 1. กำหนดรายละเอียดสิทธิ์ Azure AD
const credential = new ClientSecretCredential(
  process.env.AZURE_TENANT_ID!,
  process.env.AZURE_CLIENT_ID!,
  process.env.AZURE_CLIENT_SECRET!
);

const authProvider = new TokenCredentialAuthenticationProvider(credential, {
  scopes: ["https://graph.microsoft.com/.default"],
});

// 2. เรียกเปิดการเชื่อมต่อ Graph Client
const graphClient = Client.initWithMiddleware({ authProvider });

// 3. ฟังก์ชันจองและสร้าง Meeting URL
export async function createTeamsMeeting(subject: string, start: string, end: string) {
  const onlineMeeting = {
    subject: subject,
    startDateTime: start, // รูปแบบ ISO String
    endDateTime: end,
    lobbyBypassSettings: {
      scope: "everyone"
    }
  };

  return await graphClient
    .api("/me/onlineMeetings")
    .post(onlineMeeting);
}`}
      </pre>
    </div>
  );
}
