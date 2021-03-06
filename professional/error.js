const params = new URLSearchParams(window.location.search)

const IdentityPoolId = 'us-east-1:91756075-ee12-402d-a28f-209c6d977d44'
AWS.config.region = 'us-east-1'
AWS.config.credentials = new AWS.CognitoIdentityCredentials({IdentityPoolId})

const {h,render,Component} = window.preact

const lambda = new AWS.Lambda()

const request = (url,body,method) => {
	return fetch(url, {
		method:method || (body ? 'POST' : 'GET'),
		body:JSON.stringify(body),
		headers:{
			'Content-Type':'application/json'
		}
	})
}

/**********************************************/

class Container extends Component {
	constructor(props){
		super(props)
	}
	render(){
		return h('div',{class:'container'},
			h('div',{class:'navbar bg-secondary mb-2'},
				h('div',{class:'navbar-section'}),
				h('div',{class:'navbar-center'},
					h('a',{href:'../index.html'},
						h('img',{class:'img-responsive',style:'height: 3em',src:'../img/logo.png'})
					)
				),
				h('div',{class:'navbar-section'})
			),
			h('div',{class:'text-center'},
				h('div',{class:'h5'},'Error'),
				h('div',{class:'h6 mt-2'},
					h('a',{href:'index.html'},'Go Here')
				)
			)
		)
	}
}

document.addEventListener('DOMContentLoaded', () => render(h(Container), document.body))