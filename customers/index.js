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

const buildTimes = () => {
	const times = []
	const hourLogic = (i) => i > 11 ? i === 12 ? '12pm' : `${i-12}pm` : `${i}am`
	for(let i=6 ; i <= 20 ; i++){
		times.push({name:`${i}`, label:`${hourLogic(i)} - ${hourLogic(i+1)}`})
	}
	return times
}

/**********************************************/

class Loading extends Component {
	render(){
		return h('div',undefined,
			h('div',{class:'h4 loading'})
		)
	}
}

class Appointments extends Component {
	constructor(props){
		super(props)
		this.state.appointments = []
		this.getAppointments()
	}
	async getAppointments(){
		this.setState({loading:true})
		const r = await lambda.invoke({
			FunctionName:'fitu_get_appointments',
			Payload:JSON.stringify({
				token:window.localStorage.getItem('token'),
				type:'Customer'
			})
		}).promise()
		const appointments = JSON.parse(r.Payload)
		this.setState({loading:false, appointments:appointments})
	}
	async start(appointment){
		this.setState({loading:true})
		const r = await lambda.invoke({
			FunctionName:'fitu_appointment_action',
			Payload:JSON.stringify({
				token:window.localStorage.getItem('token'),
				sortKey:appointment.sortKey,
				type:'Customer',
				cancel:false
			})
		}).promise()
		this.setState({loading:false})
		await this.getAppointments()
	}
	async cancel(appointment){
		this.setState({loading:true})
		const r = await lambda.invoke({
			FunctionName:'fitu_appointment_action',
			Payload:JSON.stringify({
				token:window.localStorage.getItem('token'),
				sortKey:appointment.sortKey,
				type:'Customer',
				cancel:true
			})
		}).promise()
		this.setState({loading:false})
		await this.getAppointments()
	}
	content(){
		return h('div',undefined,
			!this.state.appointments.length ? 
			  h('div',{class:'empty'},
			  	h('div',{class:'empty-title h5'},'No Pending Appointments')
			  )
			:
			this.state.appointments.map((request,i) => h('div',{class:'card text-center'},
				h('div',{class:'card-header'},
					h('div',{class:'card-title h6'},request.sortKey)
				),
				h('div',{class:'card-body'},
					h('div',{class:'text-center'},request.date)
				),
				h('div',{class:'card-footer'},
					h('div',{class:'btn-group'},
						h('button',{class:'btn btn-success',onClick:e => this.start(request)},'Start'),
						h('button',{class:'btn',onClick:e => this.cancel(request)},'Cancel')
					)
				)
			))
		)
	}
	render(){
		return this.state.loading ? h('div',{class:'loading'}) : this.content()
	}
}

class ScheduleModal extends Component {
	constructor(props){
		super(props)
		this.state.schedule = {}
		this.state.count = 0
		this.state.days = ['Mondays','Tuesdays','Wednesdays','Thursdays','Fridays','Saturdays','Sundays']
		this.state.times = buildTimes()
		this.state.days.forEach(d => this.state.schedule[d] = this.state.schedule[d] || {})
	}
	toggle(d,t,e){
		if(e.target.checked && this.state.count === 3){
			this.state.schedule[d][t.name] = false
			this.setState(this.state)
		}else{
			this.state.schedule[d][t.name] = e.target.checked
			this.setState({count:this.state.count + (e.target.checked ? 1 : -1)})
		}
	}
	async request(){
		if(confirm('Really make this request?')){
			this.setState({loading:true})
			await lambda.invoke({
				FunctionName:'fitu_schedule_request',
				Payload:JSON.stringify({
					token:window.localStorage.getItem('token'),
					schedule:this.state.schedule,
					professional:this.props.result.sortKey,
					profession:this.props.profession
				})
			}).promise()
			this.setState({loading:false})
		}
	}
	checked(d,t){
		return this.state.schedule[d][t.name]
	}
	render(){
		return h('div',{class:'modal',id:'scheduleModal'},
			h('a',{href:'#close',class:'modal-overlay'}),
			h('div',{class:'modal-container'},
				h('div',{class:'modal-header'},
					h('a',{href:'#close',class:'btn btn-clear float-right'}),
					h('div',{class:'modal-title h4'},'Select upto 3 times that work for you')
				),
				h('div',{class:'modal-body'},
					h('div',{style:'height: 30em ; overflow-y: auto'},
						this.state.days.filter(d => !this.props.result.schedule || this.props.result.schedule[d]).map(d => h('div',undefined,
							h('div',{class:'text-center h5'},d),
							h('div',{class:'columns'},
								this.state.times.filter(t => !this.props.result.schedule || this.props.result.schedule[d][t.name]).map(t => h('div',{class:'column col-4 col-xs-12 text-center'},
									h('label',{class:"form-checkbox d-inline-flex"},
								    	h('input',{class:'form-input',type:'checkbox',checked:this.checked(d,t),onInput:e => this.toggle(d,t,e)}),
								    	h('i',{class:"form-icon"}),
								    	t.label
								    )
								))
							)
						))
					)
				),
				h('div',{class:'modal-footer'},
					h('div',{class:'text-center'},
						h('button',{class:'btn btn-success'+(this.state.loading ? ' loading' : ''),onClick:e => this.request()},'Request')
					)
				)
			)
		)
	}
}

class Payment extends Component {
	componentDidMount(){
		this.state.stripe = Stripe('pk_test_lSpMMl862vJHi5zAa7AErlgg00EenMRuXN')
		const elements = this.state.stripe.elements()
		const style = {
		  base: {
		    color: '#32325d',
		    fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
		    fontSmoothing: 'antialiased',
		    fontSize: '16px',
		    '::placeholder': {
		      color: '#aab7c4'
		    }
		  },
		  invalid: {
		    color: '#fa755a',
		    iconColor: '#fa755a'
		  }
		}
		this.state.card = elements.create('card',{style})
		this.state.card.mount('#card-element')
		this.state.card.on('change', function(event) {
		  var displayError = document.getElementById('card-errors');
		  if (event.error) {
		    displayError.textContent = event.error.message;
		  } else {
		    displayError.textContent = '';
		  }
		})
	}
	onSubmit(e){
		e.preventDefault()
		this.state.stripe.createToken(this.state.card).then(async (result) => {
		    if (result.error) {
		      var errorElement = document.getElementById('card-errors')
		      errorElement.textContent = result.error.message
		    } else {
		    	this.setState({loading:true})
				await lambda.invoke({
					FunctionName:'fitu_update_payment',
					Payload:JSON.stringify({
						token:window.localStorage.getItem('token'),
						nonce:result.token.id
					})
				}).promise()
				this.setState({loading:false})
				this.props.onPaymentSave()
		    }
		})
	}
	content(){
		return h('form',{id:'card-form',onSubmit:e => this.onSubmit(e)},
			h('div',{class:'text-center'},
				h('div',{id:'card-element'}),
				h('div',{id:'card-errors',role:'alert'})
			),
			h('div',{class:'text-center mt-2'},
				h('button',{class:'btn btn-success'},'Save Payment Info'),
				h('button',{class:'btn ml-1',onClick:e => this.props.onPaymentCancel()},'Cancel')
			)
		)
	}
	render(){
		return this.state.loading ? h(Loading) : this.content()
	}
}

class Profile extends Component {
	constructor(props){
		super(props)
		this.state.form = this.props.form
	}
	async save(){
		this.setState({loading:true})
		await lambda.invoke({
			FunctionName:'fitu_save_customer',
			Payload:JSON.stringify(Object.assign(this.state.form, {
				token:window.localStorage.getItem('token')
			}))
		}).promise()
		this.setState({loading:false})
	}
	updateValue(o,k,v){
		o[k] = v
		this.setState(this.state)
	}
	onPaymentSave(){
		this.state.editingPayment = false
		this.props.refresh()
	}
	onPaymentCancel(){
		this.setState({editingPayment:false})
	}
	render(){
		return h('div',undefined,
			this.state.form.hasPending && h('div',{class:'toast toast-warning text-center'},'Pending Changes'),
			h('div',{class:'form-group'},
				h('label',{class:'form-label'},'First Name'),
				h('input',{
					required:true,
					class:'form-input',
					value:this.state.form.name.first,
					onInput:e => this.updateValue(this.state.form.name,'first',e.target.value)
				})
			),
			h('div',{class:'form-group'},
				h('label',{class:'form-label'},'Middle Name'),
				h('input',{
					class:'form-input',
					value:this.state.form.name.middle,
					onInput:e => this.updateValue(this.state.form.name,'middle',e.target.value)
				})
			),
			h('div',{class:'form-group'},
				h('label',{class:'form-label'},'Last Name'),
				h('input',{
					class:'form-input',
					value:this.state.form.name.last,
					onInput:e => this.updateValue(this.state.form.name,'last',e.target.value)
				})
			),
			h('div',{class:'form-group'},
				h('label',{class:'form-label'},'Gender'),
				h('select',{
					class:'form-select',
					value:this.state.form.gender,
					onInput:e => this.updateValue(this.state.form,'gender',e.target.value)
				},
					h('option',{value:'Male'},'Male'),
					h('option',{value:'Female'},'Female')
				)
			),
			h('div',{class:'text-center mt-2'},
				h('button',{class:`btn btn-success ${this.state.loading ? 'loading' : ''}`,onClick:e => this.save()},'Save Profile')
			),
			this.state.form.payment && h('div',undefined,
				h('div',{class:'divider text-center','data-content':'Payment Details'}),
				this.state.editingPayment ? h(Payment,{
					form:this.props.form,
					onPaymentSave:() => this.onPaymentSave(),
					onPaymentCancel:() => this.onPaymentCancel()
				}) : h('div',{class:'text-center'},
					!!this.props.form.payment.card && h('div',{class:'columns'},
						h('div',{class:'column col-4'},
							h('label',{class:'form-label text-bold'},'Last 4'),
							h('label',undefined,this.props.form.payment.card.last4)
						),
						h('div',{class:'column col-4'},
							h('label',{class:'form-label text-bold'},'Brand'),
							h('label',undefined,this.props.form.payment.card.brand)
						),
						h('div',{class:'column col-4'},
							h('label',{class:'form-label text-bold'},'Expiry'),
							h('label',undefined,`${this.props.form.payment.card.exp_month}/${this.props.form.payment.card.exp_year}`)
						)
					),
					h('div',{class:'btn-group d-inline-flex'},
						h('button',{class:'btn',onClick:e => this.setState({editingPayment:true})}, this.props.form.payment.card ? 'Update Payment Info' : 'Add Payment Info')
					)
				)
			)
		)
	}
}

class Search extends Component {
	constructor(props){
		super(props)
		this.state.results = []
		this.state.result = {}
		this.state.professions = []
		this.state.zip = 22030
		this.state.radiuses = [5,10,20,40,100]
		this.state.radius = this.state.radiuses[1]
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
		results.forEach(r => {
			r.professions.forEach(r => {
				r.cost = Math.round(100*r.cost)/100
			})
		})
		this.setState({loading:false,results:results})
	}
	disableSearch(){
		return !(this.state.profession && this.state.zip && this.state.radius && this.state.gender)
	}
	async setResult(result){
		const r = await lambda.invoke({
			FunctionName:'fitu_get_availability',
			Payload:JSON.stringify({
				professional:result.sortKey,
				token:window.localStorage.getItem('token')
			})
		}).promise()
		result.schedule = JSON.parse(r.Payload)
		this.setState({result})
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
			h(ScheduleModal,{result:this.state.result, profession:this.state.profession}),
			h('div',{class:'container'},
				!this.state.results.length ? 
				  h('div',{class:'empty'},
				  	h('div',{class:'empty-title h5'},'No Results')
				  )
				: this.state.results.map(result => 
					h('div',{class:'card text-center'},
						h('div',{class:'card-image'},
							h('img',{class:'img-responsive d-inline-flex float-left',style:'height: 5em',src:result.image || '../img/generic-profile.png'}),
							h('div',{class:'float-right'},
								result.instagram && h('a',{class:'d-inline-flex',target:'_blank',href:`https://www.instagram.com/${result.instagram.replace('@','')}`},
									h('img',{class:'img-responsive',style:'height: 2em',src:'../img/instagram.jpg'})
								)
							)
						),
						h('div',{class:'card-header'},
							h('div',{class:'card-title h5'},`${result.name.first} ${result.name.middle || ''} ${result.name.last}`)
						),
						h('div',{class:'card-body'},
							result.professions.map(r => h('div',{class:'h6'},`${r.profession} (Level: ${r.level}) ($${r.cost}/hr)`))
						),
						h('div',{class:'card-footer'},
							h('div',{class:'columns'},
								h('div',{class:'column col-4 col-mx-auto text-center'},
									h('a',{class:'btn',href:'#scheduleModal',onClick:e => this.setResult(result)},'Schedule')
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
			},
			{
				name:'Profile',
				icon:'icon-people'
			},
			{
				name:'Appointments',
				icon:'icon-mail'
			}
		]
		this.state.screen = this.state.screens[0]
		this.state.form = {name:{}}
		this.profile()
	}
	async profile(){
		const r = await lambda.invoke({
			FunctionName:'fitu_get_profile',
			Payload:JSON.stringify({
				token:window.localStorage.getItem('token'),
				type:'Customer'
			})
		}).promise()
		this.setState({form:Object.assign(this.state.form, JSON.parse(r.Payload))})
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
			case 'Profile':
				return h(Profile, {form:this.state.form, refresh:() => this.profile()})
			case 'Appointments':
				return h(Appointments, {form:this.state.form})
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