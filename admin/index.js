const params = new URLSearchParams(window.location.search)
if(params.get('token') && params.get('email')){
	window.localStorage.setItem('token', params.get('token'))
	window.localStorage.setItem('email', params.get('email'))
	history.pushState({},undefined,window.location.href.replace(window.location.search,''))
}

const IdentityPoolId = 'us-east-1:91756075-ee12-402d-a28f-209c6d977d44'
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

class Menu extends Component {
	render(){
		return h('div',undefined,
			h('div',{class:'text-center'},
				h('a',{class:'off-canvas-toggle btn', href:'#sidebar'},'Menu')
			),
			h('div',{class:'off-canvas'},	
				h('div',{class:'off-canvas-sidebar',id:'sidebar'},
					h('div',{class:'container'},
						h('ul',{class:'menu'},
							this.props.screens.map(s => h('li',{class:'menu-item'},
								h('a',{href:'#close',onClick:e => this.changeMenu(e,s)},
									h('i',{class:'icon mr-2 '+s.icon}),
									h('label',{class:'form-label d-inline-flex'},s.name)
								)
							))
						)
					)
				),
				h('a',{href:'#close',class:'off-canvas-overlay'})
			)
		)
	}
}

class Modal extends Component {
	render(){
		return h('div',{class:'modal',id:this.props.id},
			h('a',{href:'#close',class:'modal-overlay'}),
			h('div',{class:'modal-container'},
				h('div',{class:'modal-header'},
					h('a',{href:'#close',class:'btn btn-clear float-right'}),
					h('div',{class:'modal-title h4 text-center'},this.props.title)
				),
				h('div',{class:'modal-body'},
					this.props.body && this.props.body
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

class RefreshDatabase extends Component {
	async refresh(e){
		this.setState({loading:true})
		await lambda.invoke({
			FunctionName:'fitu_refresh_database',
			Payload:JSON.stringify({
				token:window.localStorage.getItem('token')
			})
		}).promise()
		this.setState({loading:false})
		alert('Done')
	}
	render(){
		return h('div',{class:'text-center'},
			h('button',{class:'btn'+(this.state.loading ? ' loading' : ''),onClick:e => this.refresh(e)},
				'Refresh Database'
			)
		)
	}
}

class Approvals extends Component {
	constructor(props){
		super(props)
		this.state.user = params.get('user')
		this.state.changes = []
		this.state.comments = undefined
		this.getChange()
	}
	async getChange(){
		this.setState({loading:true})
		const r = await lambda.invoke({
			FunctionName:'fitu_get_change',
			Payload:JSON.stringify({
				user:this.state.user,
				token:window.localStorage.getItem('token')
			})
		}).promise()
		const changes = JSON.parse(r.Payload)
		this.setState({loading:false,changes:changes})
	}
	async approve(e,c){
		this.setState({loading:true})
		const r = await lambda.invoke({
			FunctionName:'fitu_make_decision',
			Payload:JSON.stringify({
				data:c.data,
				approved:true,
				token:window.localStorage.getItem('token')
			})
		}).promise()
		this.setState({loading:false})
		await this.getChange()
	}
	async reject(e){
		e && e.preventDefault()
		if(this.state.c){
			this.setState({loading:true})
			const r = await lambda.invoke({
				FunctionName:'fitu_make_decision',
				Payload:JSON.stringify({
					data:this.state.c.data,
					approved:false,
					comments:this.state.comments,
					token:window.localStorage.getItem('token')
				})
			}).promise()
			this.setState({loading:false,c:undefined})
			await this.getChange()
		}
	}
	rejectionModal(){
		return h('form',{onSubmit:e => this.reject(e)},
			h('div',{class:'text-center'},
				h('textarea',{class:'form-input',onInput:e => this.setState({comments:e.target.value}), value:this.state.comments})
			),
			h('div',{class:'text-center mt-2'},
				h('a',{class:'btn',href:'#close',onClick:e => this.reject()},'Reject'),
				h('a',{class:'btn',href:'#close'},'Cancel')
			)
		)
	}
	render(){
		return h('div',{class:'container'},
			h(Modal,{id:'rejectionModal',title:'Enter Reason for Rejection',body:this.rejectionModal()}),
			this.state.loading && h('div',{class:'loading loading-lg mt-1'}),
			h('div',{class:'mt-2'},
				!this.state.changes.length ? 
				  h('div',{class:'empty'},
				  	h('div',{class:'text-center'},
				  		h('button',{class:'btn',onClick:e => this.getChange()},'Refresh')
				  	),
				  	h('div',{class:'empty-title h5'},'No Pending Approvals')
				  )
				: this.state.changes.map((c,i) => 
					h('div',{class:'accordion',style:'display: grid'},
					  h('input',{type:'checkbox',id:`a-${i}`,hidden:true}),
					  h('label',{class:"accordion-header bg-secondary text-center",for:`a-${i}`},
					    h('i',{class:"icon icon-arrow-right mr-1"}),
					    `${c.sortKey} (${c.partitionKey})`
					  ),
					  h('div',{class:"accordion-body"},
					  	h('pre',{style:'height: 15em ; overflow-y: auto'},
					  		JSON.stringify(c.data,null,2)
					  	),
					  	h('div',{class:'btn-group btn-group-block'},
					  		h('button',{class:'btn btn-success'+(this.state.loading ? ' loading' : ''),onClick:e => this.approve(e,c)},'Approve'),
					  		h('a',{href:'#rejectionModal',class:'btn',onClick:e => this.setState({c})},'Reject')
					  	)
					  )
					)
				)
			)
		)
	}
}

class ProfilePictures extends Component {
	async submit(e){
		e.preventDefault()
		this.setState({loading:true})
		await lambda.invoke({
			FunctionName:'fitu_profile_picture',
			Payload:JSON.stringify({
				user:this.state.email,
				url:this.state.url,
				token:window.localStorage.getItem('token')
			})
		}).promise()
		this.setState({loading:false})
		alert('Updated profile picture')
	}
	render(){
		return h('form',{class:'container',onSubmit:e => this.submit(e)},
			h('div',{class:'columns'},
				h('div',{class:'column col-6'},
					h('input',{class:'form-input',placeholder:'Enter email',onInput:e => this.setState({email:e.target.value})})
				),
				h('div',{class:'column col-6'},
					h('input',{class:'form-input',placeholder:'Enter photo URL',onInput:e => this.setState({url:e.target.value})})
				)
			),
			h('div',{class:'text-center mt-2'},
				h('button',{class:'btn'+(this.state.loading ? ' loading' : ''),disabled:!(this.state.email && this.state.url)},'Submit')
			)
		)
	}
}

class Container extends Component {
	constructor(props){
		super(props)
		this.state.screens = [
			{
				name:'Refresh Database',
				icon:'icon-refresh'
			},
			{
				name:'Approvals',
				icon:'icon-check'
			},
			{
				name:'Profile Pictures',
				icon:'icon-photo'
			}
		]
		this.state.screen = this.state.screens[0]
	}
	changeMenu(e,s){
		this.setState({screen:s})
	}
	hasAuth(){
		return window.localStorage.getItem('email') && window.localStorage.getItem('token')
	}
	screen(){
		switch(this.state.screen.name){
			case 'Approvals':
				return h(Approvals)
			case 'Profile Pictures':
				return h(ProfilePictures)
			case 'Refresh Database':
				return h(RefreshDatabase)
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