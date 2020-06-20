const params = new URLSearchParams(window.location.search)

const IdentityPoolId = 'us-east-1:fc77f43d-2fe4-4855-9626-fc98cd765fe7'
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
		this.onLoad()
	}
	async onLoad(){
		if(params.get('code')){
			this.setState({loading:true})
			const r = await lambda.invoke({
				FunctionName:'fitu_confirm_professional_payment_update',
				Payload:JSON.stringify({
					token:window.localStorage.getItem('token'),
					code:params.get('code'),
					csrf:params.get('state')
				})
			}).promise()
			this.setState({loading:false})
		}
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
				h('div',{class:'h5'},'Success'),
				this.state.loading ? h('div',{class:'loading'}) : h('div',{class:'h6 mt-2'},
					h('a',{href:'index.html'},'Go Here')
				)
			)
		)
	}
}

document.addEventListener('DOMContentLoaded', () => render(h(Container), document.body))