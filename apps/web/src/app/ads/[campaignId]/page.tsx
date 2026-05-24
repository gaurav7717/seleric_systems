export default function CampaignDetailPage({ params }: { params: { campaignId: string } }) {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Campaign {params.campaignId}</h1>
    </main>
  )
}
