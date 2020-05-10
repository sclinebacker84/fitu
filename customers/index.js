const params = new URLSearchParams(window.location.search)
if(params.get('token') && params.get('email')){
	window.localStorage.setItem('token', params.get('token'))
	window.localStorage.setItem('email', params.get('email'))
	history.pushState({},undefined,window.location.href.replace(window.location.search,''))
}

const IdentityPoolId = 'us-east-1:fc77f43d-2fe4-4855-9626-fc98cd765fe7'
AWS.config.region = 'us-east-1'
AWS.config.credentials = new AWS.CognitoIdentityCredentials({IdentityPoolId})

const {h,render,Component} = window.preact

const dynamodb = new AWS.DynamoDB.DocumentClient({convertEmptyValues:true})
const lambda = new AWS.Lambda()

/**********************************************/

class Loading extends Component {
	render(){
		return h('div',undefined,
			h('div',{class:'h4 loading'})
		)
	}
}

class Modal extends Component {
	render(){
		return h('div',{class:'modal',id:this.props.id || 'modal'},
			h('a',{href:'#close',class:'modal-overlay'}),
			h('div',{class:'modal-container'},
				h('div',{class:'modal-header'},
					h('a',{href:'#close',class:'btn btn-clear float-right'}),
					h('div',{class:'modal-title h4'},this.props.title || 'Title')
				),
				h('div',{class:'modal-body'},
					this.body && this.body()
				),
				h('div',{class:'modal-footer'},
					this.footer && this.footer()
				)
			)
		)
	}
}

class Search extends Component {
	constructor(props){
		super(props)
		this.state.results = []
		this.state.professions = []
		this.state.zip = 22030
		this.state.radiuses = [5,10,20,40,100]
		this.state.radius = this.state.radiuses[0]
		this.state.genders = ['All Genders','Male','Female']
		this.state.gender = this.state.genders[0]
		this.reference()
	}
	async reference(){
		this.setState({loading:true})
		const professions = new Set()
		const r = await dynamodb.get({
			TableName:'configs',
			Key:{
				partitionKey:'fitu_certs'
			}
		}).promise()
		r.Item.data.forEach(r => professions.add(r.profession))
		this.setState({professions:Array.from(professions), loading:false})
		this.setState({profession:this.state.professions[0]})
	}
	async search(e){
		this.setState({loading:true})
		const r = await lambda.invoke({
			FunctionName:'fitu_search',
			Payload:JSON.stringify({
				profession:this.state.profession,
				zip:''+this.state.zip,
				radius:this.state.radius,
				gender:this.state.gender,
				token:window.localStorage.getItem('token')
			})
		}).promise()
		const results = JSON.parse(r.Payload)
		results.forEach(r => r.level = r.certifications.reduce((a,c) => {
			a[c.profession] = a[c.profession] || 0
			a[c.profession]++
			return a
		},{}))
		this.setState({loading:false,results:results})
	}
	disableSearch(){
		return !(this.state.profession && this.state.zip && this.state.radius && this.state.gender)
	}
	render(){
		return h('div',undefined,
			h('div',{class:'columns'},
				h('div',{class:'column col-3 col-xs-12'},
					h('select',{class:'form-select',onInput: e => this.setState({profession:e.target.value}), value:this.state.profession},
						this.state.professions.map(p => h('option',{value:p},p))
					)
				),
				h('div',{class:'column col-3 col-xs-12'},
					h('input',{class:'form-input',type:'number',onInput:e => this.setState({zip:e.target.value}),value:this.state.zip})
				),
				h('div',{class:'column col-3 col-xs-12'},
					h('select',{class:'form-select',onInput: e => this.setState({radius:e.target.value}), value:this.state.radius},
						this.state.radiuses.map(p => h('option',{value:p},p+' miles'))
					)
				),
				h('div',{class:'column col-3 col-xs-12'},
					h('select',{class:'form-select',onInput: e => this.setState({gender:e.target.value}), value:this.state.gender},
						this.state.genders.map(p => h('option',{value:p},p))
					)
				)
			),
			h('div',{class:'text-center mt-1 mb-1'},
				h('button',{class:'btn'+(this.state.loading ? ' loading' : ''),disabled:this.disableSearch(),onClick:e => this.search(e)},'Search')
			),
			h('div',{class:'container'},
				!this.state.results.length ? 
				  h('div',{class:'empty'},
				  	h('div',{class:'empty-title h5'},'No Results')
				  )
				: this.state.results.map(result => 
					h('div',{class:'card text-center'},
						h('div',{class:'card-image'},
							h('img',{class:'img-responsive d-inline-flex',style:'height: 5em',src:result.image || '../img/generic-profile.png'})
						),
						h('div',{class:'card-header'},
							h('div',{class:'card-title h5'},`${result.name.first} ${result.name.middle || ''} ${result.name.last}`)
						),
						h('div',{class:'card-body'},
							Object.keys(result.level).map(r => h('div',{class:'h6'},`${r} (Level: ${result.level[r]})`))
						),
						h('div',{class:'card-footer'},
							h('div',{class:'columns'},
								h('div',{class:'column col-4 col-mx-auto text-center'},
									result.instagram && h('a',{class:'d-inline-flex',target:'_blank',href:`https://www.instagram.com/${result.instagram.replace('@','')}`},
										h('img',{class:'img-responsive',style:'height: 2em',src:'../img/instagram.jpg'})
									)
								)
							)
						)
					)
				)
			)
		)
	}
}

class Auth extends Component {
	async auth(e){
		e.preventDefault()
		this.setState({loading:true})
		await lambda.invoke({
			FunctionName:'auth',
			Payload:JSON.stringify({email:this.state.email,url:window.location.href,name:'FitU'})
		}).promise()
		this.setState({loading:false})
		alert('Done!')
	}
	render(){
		return h('div',undefined,
			h('form',{class:'form-group text-center',onSubmit:e => this.auth(e)},
				h('label',{class:'form-label'},'Enter Email'),
				h('input',{class:'form-input text-center',onInput:e => this.setState({email:e.target.value})}),
				h('button',{class:`btn mt-1 ${this.state.loading ? 'loading' : ''}`},'Submit')
			)
		)
	}
}

class Container extends Component {
	constructor(props){
		super(props)
		this.state.screens = [
			{
				name:'Search',
				icon:'icon-search'
			}
		]
		this.state.screen = this.state.screens[0]
	}
	hasAuth(){
		return window.localStorage.getItem('email') && window.localStorage.getItem('token')
	}
	changeMenu(e,s){
		this.setState({screen:s})
	}
	screen(){
		switch(this.state.screen.name){
			case 'Search':
				return h(Search)
		}
	}
	content(){
		return h('div',{class:'container'},
			h('div',{class:'navbar bg-secondary mb-2'},
				h('div',{class:'navbar-section'},
					h('a',{class:'off-canvas-toggle btn btn-link', href:'#sidebar'},
						h('i',{class:'icon icon-menu'})
					)
				),
				h('div',{class:'navbar-center'},
					h('img',{class:'img-responsive',style:'height: 3em',src:'../img/logo.png'})
				),
				h('div',{class:'navbar-section'})
			),
			h('div',{class:'off-canvas'},
				h('div',{class:'off-canvas-content',style:'padding: 0px'},
					this.screen()
				),
				h('div',{class:'off-canvas-sidebar',id:'sidebar'},
					h('div',{class:'container'},
						h('ul',{class:'menu'},
							this.state.screens.map(s => h('li',{class:'menu-item'},
								h('a',{href:'#close',onClick:e => this.changeMenu(e,s)},
									h('i',{class:'icon mr-2 '+s.icon}),
									h('label',{class:'form-label d-inline-flex'+(this.state.screen === s ? ' text-bold' : '')},s.name)
								)
							))
						)
					)
				),
				h('a',{href:'#close',class:'off-canvas-overlay'})
			)
		)
	}
	render(){
		return this.hasAuth() ? this.content() : h(Auth)
	}
}

document.addEventListener('DOMContentLoaded', () => render(h(Container), document.body))