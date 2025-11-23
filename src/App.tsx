import OrgTree from './org-tree/OrgTree';
import { makeServer } from './services/mock-server'

makeServer();

function App() {
  return (
    <OrgTree />
  )
}

export default App
