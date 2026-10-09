import { Route, Switch } from 'wouter'
import Layout from './components/Layout.jsx'
import Home from './pages/Home.jsx'
import Inscripcion from './pages/Inscripcion.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/inscripcion" component={Inscripcion} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  )
}
