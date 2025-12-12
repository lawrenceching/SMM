import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileList } from "./FileList"
import { TMDBTVShowOverview } from "./tmdb-tvshow-overview"
import { TvShowEpisodes } from "./tvshow-episodes"
import { useMediaMetadata } from "./media-metadata-provider"

function TvShowPanel() {

  const { selectedMediaMetadata: mediaMetadata } = useMediaMetadata()

  return (
    <div className='p-1 w-full h-full'>
        <Tabs defaultValue="account" className="w-full h-full">
        <TabsList>
            <TabsTrigger value="overall">Overall</TabsTrigger>
            <TabsTrigger value="tvshow">Tv Show</TabsTrigger>
            <TabsTrigger value="filess">Files</TabsTrigger>
        </TabsList>
        <TabsContent value="overall" className="w-full h-full" >   
            <TMDBTVShowOverview className="w-full h-full"/>
        </TabsContent>
        <TabsContent value="tvshow">
        <TvShowEpisodes />
        </TabsContent>
        <TabsContent value="filess">
            <FileList files={mediaMetadata?.files ?? []} />
        </TabsContent>
        </Tabs>
    </div>
  )
}

export default TvShowPanel